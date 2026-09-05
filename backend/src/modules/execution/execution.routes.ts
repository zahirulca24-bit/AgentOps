import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { EnvConfig } from '../../config/env.js';
import { redactObject } from '../../infrastructure/redact/redactSensitive.js';
import { AppError } from '../../core/errors.js';

const runParamsSchema = z.object({
  id: z.string().uuid(),
});

// Map of active SSE subscribers per run ID
const activeSubscribersMap = new Map<string, Set<FastifyReply>>();

export function getActiveSubscriberCount(runId: string): number {
  return activeSubscribersMap.get(runId)?.size || 0;
}

export async function executionRoutes(fastify: FastifyInstance, options: { config: EnvConfig }) {
  const { config } = options;

  fastify.get('/api/v1/runs/:id/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsResult = runParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid run ID format. Must be a valid UUID.',
          requestId: request.id,
        }
      });
    }

    const runId = paramsResult.data.id;
    const currentSubscribers = activeSubscribersMap.get(runId) || new Set<FastifyReply>();

    if (currentSubscribers.size >= (config.MAX_SSE_SUBSCRIBERS || 10)) {
      throw new AppError('ACTION_LIMIT_REACHED', `Maximum SSE subscribers reached for run ${runId}`, 429);
    }

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.statusCode = 200;

    currentSubscribers.add(reply);
    activeSubscribersMap.set(runId, currentSubscribers);

    // Send initial connected event
    const initialEvent = redactObject({
      event: 'connected',
      runId,
      timestamp: new Date().toISOString(),
    });
    reply.raw.write(`event: connected\ndata: ${JSON.stringify(initialEvent)}\n\n`);

    // Setup periodic heartbeat ping
    const heartbeatTimer = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`);
      }
    }, 30000);

    // Cleanup on client disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeatTimer);
      const subscribers = activeSubscribersMap.get(runId);
      if (subscribers) {
        subscribers.delete(reply);
        if (subscribers.size === 0) {
          activeSubscribersMap.delete(runId);
        }
      }
    });
  });
}

export function broadcastRunEvent(runId: string, eventName: string, payload: any) {
  const subscribers = activeSubscribersMap.get(runId);
  if (!subscribers || subscribers.size === 0) return;

  const redactedPayload = redactObject(payload);
  const dataString = `event: ${eventName}\ndata: ${JSON.stringify(redactedPayload)}\n\n`;

  for (const subscriberReply of subscribers) {
    if (!subscriberReply.raw.writableEnded) {
      subscriberReply.raw.write(dataString);
    }
  }
}
