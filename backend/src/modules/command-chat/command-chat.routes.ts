import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AIProvider } from '../../core/ai/provider.js';
import type { Database } from '../../infrastructure/db/client.js';
import { AppError } from '../../core/errors.js';
import { CommandChatService } from './command-chat.service.js';

const dispatchSchema = z.object({
  command: z.string().min(1).max(4000),
  context: z.object({ page: z.string().min(1), runId: z.string().optional() }),
  actor: z.string().min(1).optional(),
});

export async function commandChatRoutes(app: FastifyInstance, options: { aiProvider: AIProvider; db?: Database }) {
  const service = new CommandChatService(options.aiProvider);
  app.post('/api/v1/command-chat/dispatch', async (request, reply) => {
    const parsed = dispatchSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid AI command chat payload', 400);
    const result = await service.dispatch(parsed.data.command, parsed.data.context, parsed.data.actor);
    return reply.send({ data: result });
  });
}
