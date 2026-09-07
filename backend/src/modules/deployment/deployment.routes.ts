import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../infrastructure/db/client.js';
import { AppError } from '../../core/errors.js';
import { PreviewDeploymentService } from './deployment.service.js';
import { createPreviewDeploymentSchema, getDeploymentStatusSchema } from './deployment.schema.js';

export async function deploymentRoutes(
  fastify: FastifyInstance,
  options: { db?: Database }
) {
  const deploymentService = new PreviewDeploymentService(options.db);

  // POST /api/v1/deployments/preview - Trigger Preview Deployment
  fastify.post('/api/v1/deployments/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createPreviewDeploymentSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid preview deployment payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const result = await deploymentService.createPreviewDeployment(parseResult.data);

    const statusCode = result.status === 'failed' ? 422 : 201;
    return reply.status(statusCode).send({ data: result });
  });

  // GET /api/v1/deployments/preview/:id - Get Preview Deployment Status
  fastify.get('/api/v1/deployments/preview/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid deployment ID format', 400);
    }

    const queryParse = getDeploymentStatusSchema.safeParse(request.query);
    if (!queryParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Provider and branchName query parameters are required', 400);
    }

    const result = await deploymentService.getDeploymentStatus(paramParse.data.id, queryParse.data);
    return reply.send({ data: result });
  });

  // GET /api/v1/deployments/preview - List Preview Deployments
  fastify.get('/api/v1/deployments/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const list = await deploymentService.listDeployments();
    return reply.send({ data: list });
  });
}
