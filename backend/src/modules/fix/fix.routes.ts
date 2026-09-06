import type { FastifyPluginAsync } from 'fastify';
import { CodeFixService } from './fix.service.js';
import { codeFixInputSchema } from './fix.schema.js';
import { AppError } from '../../core/errors.js';
import { redactObject } from '../../infrastructure/redact/redactSensitive.js';
import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
import type { GitHubProvider } from '../github/github.provider.js';

export interface FixRoutesOptions {
  db: Database;
  aiProvider: AIProvider;
  githubProvider?: GitHubProvider;
}

export const fixRoutes: FastifyPluginAsync<FixRoutesOptions> = async (fastify, opts) => {
  const service = new CodeFixService(opts.db, opts.aiProvider, opts.githubProvider);

  // POST /api/v1/issues/:id/fix
  fastify.post<{ Params: { id: string } }>('/issues/:id/fix', async (request, reply) => {
    const { id } = request.params;
    if (!id) {
      throw new AppError('VALIDATION_ERROR', 'Issue ID is required', 400);
    }

    const parseResult = codeFixInputSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid code fix request payload';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const proposal = await service.generateFixProposal(id, parseResult.data);
    const safeProposal = redactObject(proposal);

    return reply.status(200).send({
      status: 'success',
      data: {
        proposal: safeProposal,
      },
    });
  });
};
