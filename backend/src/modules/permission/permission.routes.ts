import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../infrastructure/db/client.js';
import { AppError } from '../../core/errors.js';
import { PermissionEngineService } from './permission.service.js';
import { evaluatePermissionSchema } from './permission.schema.js';

export async function permissionRoutes(
  fastify: FastifyInstance,
  options: { db?: Database; permissionService?: PermissionEngineService }
) {
  const permissionService = options.permissionService || new PermissionEngineService(options.db);

  // POST /api/v1/permissions/evaluate - Evaluate Action Permission (Green / Yellow / Red)
  fastify.post('/api/v1/permissions/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = evaluatePermissionSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid permission evaluation payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const evaluation = await permissionService.evaluatePermission(parseResult.data);
    const statusCode = evaluation.outcome === 'deny' ? 403 : 200;
    return reply.status(statusCode).send({ data: evaluation });
  });

  // GET /api/v1/permissions/audit - List Decision-Level Permission Audit Logs
  fastify.get('/api/v1/permissions/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    const list = await permissionService.listPermissionAuditLogs();
    return reply.send({ data: list });
  });

  // GET /api/v1/permissions/rules - Get Action Classification Tiers (Green / Yellow / Red)
  fastify.get('/api/v1/permissions/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const rules = permissionService.getRules();
    return reply.send({ data: rules });
  });
}
