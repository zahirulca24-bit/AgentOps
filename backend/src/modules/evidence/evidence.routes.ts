import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EvidenceService } from './evidence.service.js';
import type { EnvConfig } from '../../config/env.js';

const getEvidenceParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function evidenceRoutes(fastify: FastifyInstance, options: { config: EnvConfig }) {
  const evidenceService = new EvidenceService(options.config);

  fastify.get('/api/v1/evidence/:id', async (request, reply) => {
    const parseResult = getEvidenceParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid evidence ID format. Must be a valid UUID.',
          requestId: request.id,
        }
      });
    }

    const { id } = parseResult.data;
    const { content, filePath } = await evidenceService.getEvidence(id);

    // Set simple content type based on extension
    if (filePath.endsWith('.png')) {
      reply.type('image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      reply.type('image/jpeg');
    } else if (filePath.endsWith('.json')) {
      reply.type('application/json');
    } else if (filePath.endsWith('.txt') || filePath.endsWith('.log')) {
      reply.type('text/plain');
    } else {
      reply.type('application/octet-stream');
    }

    return reply.send(content);
  });
}
