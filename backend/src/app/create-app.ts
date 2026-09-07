import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import crypto from 'crypto';
import { healthRoutes } from '../modules/health/health.routes.js';
import { plannerRoutes } from '../modules/planner/planner.routes.js';
import { evidenceRoutes } from '../modules/evidence/evidence.routes.js';
import { executionRoutes } from '../modules/execution/execution.routes.js';
import { AppError } from '../core/errors.js';
import type { EnvConfig } from '../config/env.js';
import { createDbClient } from '../infrastructure/db/client.js';
import { GeminiProvider } from '../infrastructure/ai/gemini-provider.js';
import { BrowserManager } from '../infrastructure/browser/browser.manager.js';
import { redactString } from '../infrastructure/redact/redactSensitive.js';

import { apiRoutes } from '../modules/api/api.routes.js';
import { githubRoutes } from '../modules/github/github.routes.js';
import { runnerRoutes } from '../modules/runner/runner.routes.js';
import { selfFixRoutes } from '../modules/self-fix/self-fix.routes.js';
import { deploymentRoutes } from '../modules/deployment/deployment.routes.js';
import { approvalRoutes } from '../modules/approval/approval.routes.js';
import { permissionRoutes } from '../modules/permission/permission.routes.js';

export async function createApp(config: EnvConfig) {
  const dbClient = createDbClient(config);
  const aiProvider = new GeminiProvider(config);
  const browserManager = new BrowserManager(config, false); // always false in production

  const app = fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.password',
        'req.headers.token',
        'req.headers.accesstoken',
        'req.headers.refreshtoken',
        'req.headers.apikey',
        'req.headers.secret',
        'req.headers.github_token',
        'DATABASE_URL',
        'GEMINI_API_KEY',
      ]
    },
    genReqId: function (req) {
      // Very basic validation: only allow alphanumeric, dash, underscore
      const reqId = req.headers['x-request-id'];
      if (reqId && typeof reqId === 'string' && /^[a-zA-Z0-9_-]+$/.test(reqId)) {
        return reqId;
      }
      return crypto.randomUUID();
    },
    requestIdHeader: 'x-request-id',
  });

  // Security Headers via @fastify/helmet
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "*"],
        imgSrc: ["'self'", "data:", "blob:"],
      }
    }
  });

  // Rate Limiting via @fastify/rate-limit
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_READ_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (request, context) => ({
      error: {
        code: 'ACTION_LIMIT_REACHED',
        message: `Rate limit exceeded. Maximum ${context.max} requests per ${context.after}`,
        requestId: request.id
      }
    })
  });

  // Ensure request ID is returned in headers
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  await app.register(cors, {
    origin: config.CORS_ORIGINS,
  });

  // Global Error Handler with secret redaction
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    
    if (error instanceof AppError) {
      request.log.warn({ err: error }, `App error: ${error.code}`);
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: redactString(error.message),
          requestId
        }
      });
    }

    // Fastify rate limit error handling
    const errObj = error as any;
    if (errObj && errObj.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'ACTION_LIMIT_REACHED',
          message: redactString(errObj.message || 'Rate limit exceeded'),
          requestId
        }
      });
    }

    // Default to 500 for unhandled exceptions
    request.log.error({ err: error }, 'Unhandled exception');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId
      }
    });
  });

  // Global Not Found Handler
  app.setNotFoundHandler((request, reply) => {
    const requestId = request.id;
    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId
      }
    });
  });

  // Register routes
  await app.register(healthRoutes, dbClient.db);
  await app.register(plannerRoutes, { db: dbClient.db, aiProvider });
  await app.register(evidenceRoutes, { config });
  await app.register(executionRoutes, { config });
  await app.register(apiRoutes, { db: dbClient.db, aiProvider, browserManager, config });
  await app.register(githubRoutes, { prefix: '/api/v1/github' });
  await app.register(selfFixRoutes, { prefix: '/api/v1/issues', db: dbClient.db, aiProvider });
  await app.register(deploymentRoutes, { db: dbClient.db });
  await app.register(approvalRoutes, { db: dbClient.db });
  await app.register(permissionRoutes, { db: dbClient.db });


  // Close database connection gracefully
  app.addHook('onClose', async () => {
    await browserManager.cleanup();
    await dbClient.close();
  });

  return app;
}
