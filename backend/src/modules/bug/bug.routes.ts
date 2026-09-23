import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors.js';
import { BugService } from './bug.service.js';
import type { EnvConfig } from '../../config/env.js';

const createBugSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'investigating', 'fixed', 'closed']).default('open'),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function bugRoutes(fastify: FastifyInstance, options: { config: EnvConfig }) {
  const bugService = new BugService(options.config.BUG_STORAGE_DIR || './bugs');

  // POST /api/v1/bugs - create bug
  fastify.post('/api/v1/bugs', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createBugSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid bug payload', 400);
    }
    const bug = await bugService.createBug(parseResult.data);
    return reply.status(201).send({ data: bug });
  });

  // GET /api/v1/bugs/:id - retrieve bug
  fastify.get('/api/v1/bugs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid bug ID format', 400);
    }
    const bug = await bugService.getBug(parseResult.data.id);
    return reply.send({ data: bug });
  });

  // GET /api/v1/bugs - list all bugs
  fastify.get('/api/v1/bugs', async (request: FastifyRequest, reply: FastifyReply) => {
    const bugs = await bugService.listBugs();
    return reply.send({ data: bugs });
  });

  // PATCH /api/v1/bugs/:id - update bug (partial)
  fastify.patch('/api/v1/bugs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramParse = idParamSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid bug ID format', 400);
    }
    const bugId = paramParse.data.id;
    const patch = request.body as Partial<{
      title?: string;
      description?: string;
      severity?: 'critical' | 'high' | 'medium' | 'low';
      status?: 'open' | 'investigating' | 'fixed' | 'closed';
    }>;
    const updated = await bugService.updateBug(bugId, patch);
    return reply.send({ data: updated });
  });
}
