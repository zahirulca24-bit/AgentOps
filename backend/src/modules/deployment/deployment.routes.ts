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
import { triggerPostDeploymentQABodySchema } from './post-deployment-qa.schema.js';
import {
  requestProductionDeploymentSchema,
  approveProductionDeploymentSchema,
  executeProductionDeploymentSchema,
} from './production-deployment.schema.js';
import { autoRollbackSchema, manualRollbackSchema } from './rollback.schema.js';

export async function deploymentRoutes(
  fastify: FastifyInstance,
  options: { db?: Database; aiProvider?: AIProvider }
) {
  const deploymentService = new PreviewDeploymentService(options.db, options.aiProvider);
  const prodService = deploymentService.productionDeploymentService;
  const rollbackService = prodService.rollbackService;

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

  // POST /api/v1/deployments/preview/:id/qa-run - Trigger Post-Deployment QA Run
  fastify.post('/api/v1/deployments/preview/:id/qa-run', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid deployment ID format', 400);
    }

    const bodyParse = triggerPostDeploymentQABodySchema.safeParse(request.body || {});
    if (!bodyParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid QA run payload', 400);
    }

    const summary = await deploymentService.triggerPostDeploymentQA(paramParse.data.id, bodyParse.data);
    return reply.status(201).send({ data: summary });
  });

  // GET /api/v1/deployments/preview/:id/qa-status - Get Post-Deployment QA Run Status & Verdict
  fastify.get('/api/v1/deployments/preview/:id/qa-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid deployment ID format', 400);
    }

    const summary = await deploymentService.getPostDeploymentQAStatus(paramParse.data.id);
    return reply.send({ data: summary });
  });

  // POST /api/v1/deployments/production/request - Request Production Deployment
  fastify.post('/api/v1/deployments/production/request', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = requestProductionDeploymentSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid production deployment request payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const result = await prodService.requestProductionDeployment(parseResult.data);
    return reply.status(201).send({ data: result });
  });

  // POST /api/v1/deployments/production/approve - Human Approval Gate for Production Deployment
  fastify.post('/api/v1/deployments/production/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = approveProductionDeploymentSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid production approval payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const result = await prodService.approveProductionDeployment(parseResult.data);
    return reply.status(200).send({ data: result });
  });

  // POST /api/v1/deployments/production/deploy - Execute Approved Production Deployment
  fastify.post('/api/v1/deployments/production/deploy', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = executeProductionDeploymentSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid production deployment execution payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const result = await prodService.executeProductionDeployment(parseResult.data);
    const statusCode = result.status === 'failed' ? 422 : 200;
    return reply.status(statusCode).send({ data: result });
  });

  // GET /api/v1/deployments/production/:id - Get Production Deployment Status
  fastify.get('/api/v1/deployments/production/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid production deployment ID format', 400);
    }

    const result = await prodService.getProductionDeploymentStatus(paramParse.data.id);
    return reply.send({ data: result });
  });

  // GET /api/v1/deployments/production - List Production Deployments
  fastify.get('/api/v1/deployments/production', async (request: FastifyRequest, reply: FastifyReply) => {
    const list = await prodService.listProductionDeployments();
    return reply.send({ data: list });
  });

  // POST /api/v1/deployments/rollback/auto - Trigger Automatic Emergency Rollback
  fastify.post('/api/v1/deployments/rollback/auto', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = autoRollbackSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid auto rollback payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const result = await rollbackService.executeAutoRollback(parseResult.data);
    return reply.status(200).send({ data: result });
  });

  // POST /api/v1/deployments/rollback/manual - Trigger Manual Rollback (Human Approval Enforced)
  fastify.post('/api/v1/deployments/rollback/manual', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = manualRollbackSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid manual rollback payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const result = await rollbackService.executeManualRollback(parseResult.data);
    return reply.status(200).send({ data: result });
  });

  // GET /api/v1/deployments/rollback/stable - Get Previous Stable Production Deployment
  fastify.get('/api/v1/deployments/rollback/stable', async (request: FastifyRequest, reply: FastifyReply) => {
    const stable = await rollbackService.getPreviousStableDeployment();
    return reply.send({ data: stable });
  });

  // GET /api/v1/deployments/rollback/:id - Get Rollback Details by ID
  fastify.get('/api/v1/deployments/rollback/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid rollback ID format', 400);
    }

    const result = await rollbackService.getRollbackStatus(paramParse.data.id);
    return reply.send({ data: result });
  });

  // GET /api/v1/deployments/rollback - List All Rollbacks
  fastify.get('/api/v1/deployments/rollback', async (request: FastifyRequest, reply: FastifyReply) => {
    const list = await rollbackService.listRollbacks();
    return reply.send({ data: list });
  });
}
