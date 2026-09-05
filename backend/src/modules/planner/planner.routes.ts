import type { FastifyInstance } from 'fastify';
import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
import { PlannerService } from './planner.service.js';
import { z } from 'zod';
import { AppError } from '../../core/errors.js';

export async function plannerRoutes(app: FastifyInstance, opts: { db: Database; aiProvider: AIProvider }) {
  const plannerService = new PlannerService(opts.db, opts.aiProvider);

  app.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/plan', async (request, reply) => {
    // Validate taskId format (UUID)
    const { taskId } = request.params;
    const uuidParse = z.string().uuid().safeParse(taskId);
    if (!uuidParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid task ID format', 400);
    }

    const startMs = Date.now();
    try {
      const plan = await plannerService.generatePlan(taskId);
      
      request.log.info({
        taskId,
        durationMs: Date.now() - startMs,
        stepCount: plan.steps.length
      }, 'Successfully generated and persisted QA plan');

      return reply.status(200).send({ plan });
    } catch (err) {
      request.log.error({ err, taskId, durationMs: Date.now() - startMs }, 'Planning failed');
      throw err; // Rely on the centralized error handler
    }
  });
}
