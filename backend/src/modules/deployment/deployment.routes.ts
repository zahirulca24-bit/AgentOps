import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
import { AppError } from '../../core/errors.js';
import { PreviewDeploymentService } from './deployment.service.js';
import {
  createPreviewDeploymentSchema,
  getDeploymentStatusSchema,
  analyzeDeploymentLogsBodySchema,
} from './deployment.schema.js';

export async function deploymentRoutes(
  fastify: FastifyInstance,
  options: { db?: Database; aiProvider?: AIProvider }
) {
  const deploymentService = new PreviewDeploymentService(options.db, options.aiProvider);

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

  // POST /api/v1/deployments/analyze-logs - Analyze Raw Deployment Logs
  fastify.post('/api/v1/deployments/analyze-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = analyzeDeploymentLogsBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid log analysis payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const analysis = await deploymentService.analyzeDeploymentLogs(parseResult.data.logs, {
      deploymentId: parseResult.data.deploymentId,
      runId: parseResult.data.runId,
      provider: parseResult.data.provider,
      branchName: parseResult.data.branchName,
    });

    return reply.status(200).send({ data: analysis });
  });

  // GET /api/v1/deployments/run/:runId/analysis - Get Deployment Log Analysis by QA Run ID
  fastify.get('/api/v1/deployments/run/:runId/analysis', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ runId: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid runId parameter', 400);
    }

    const analysis = await deploymentService.getDeploymentAnalysisByRunId(paramParse.data.runId);
    if (!analysis) {
      throw new AppError('NOT_FOUND', `No deployment log analysis found for QA runId '${paramParse.data.runId}'`, 404);
    }

    return reply.send({ data: analysis });
  });
}
