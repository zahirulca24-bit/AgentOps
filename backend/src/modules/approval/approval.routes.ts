import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../infrastructure/db/client.js';
import { AppError } from '../../core/errors.js';
import { HumanApprovalService } from './approval.service.js';
import {
  createApprovalRequestSchema,
  decideApprovalSchema,
  criticalActionCategoryEnum,
  approvalStatusEnum,
} from './approval.schema.js';

export async function approvalRoutes(
  fastify: FastifyInstance,
  options: { db?: Database; approvalService?: HumanApprovalService }
) {
  const approvalService = options.approvalService || new HumanApprovalService(options.db);

  // POST /api/v1/approvals/request - Request Human Approval for Critical Action
  fastify.post('/api/v1/approvals/request', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createApprovalRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errMsg = parseResult.error.issues[0]?.message || 'Invalid approval request payload';
      throw new AppError('VALIDATION_ERROR', errMsg, 400);
    }

    const result = await approvalService.createApprovalRequest(parseResult.data);
    return reply.status(201).send({ data: result });
  });

  // POST /api/v1/approvals/:id/approve - Approve Pending Approval Request
  fastify.post('/api/v1/approvals/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid approval ID format', 400);
    }

    const bodySchema = z.object({
      actor: z.string().min(1, 'Approver identity is required'),
      reason: z.string().optional(),
    });
    const bodyParse = bodySchema.safeParse(request.body);
    if (!bodyParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Approver identity (actor) is required', 400);
    }

    const result = await approvalService.approveRequest(paramParse.data.id, bodyParse.data.actor, bodyParse.data.reason);
    return reply.status(200).send({ data: result });
  });

  // POST /api/v1/approvals/:id/reject - Reject Pending Approval Request
  fastify.post('/api/v1/approvals/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid approval ID format', 400);
    }

    const bodySchema = z.object({
      actor: z.string().min(1, 'Rejecter identity is required'),
      reason: z.string().optional(),
    });
    const bodyParse = bodySchema.safeParse(request.body);
    if (!bodyParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Rejecter identity (actor) is required', 400);
    }

    const result = await approvalService.rejectRequest(paramParse.data.id, bodyParse.data.actor, bodyParse.data.reason);
    return reply.status(200).send({ data: result });
  });

  // GET /api/v1/approvals/:id - Get Approval Request Status
  fastify.get('/api/v1/approvals/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const paramParse = paramsSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid approval ID format', 400);
    }

    const result = await approvalService.getApprovalRequest(paramParse.data.id);
    return reply.send({ data: result });
  });

  // GET /api/v1/approvals - List Approval Requests
  fastify.get('/api/v1/approvals', async (request: FastifyRequest, reply: FastifyReply) => {
    const querySchema = z.object({
      status: approvalStatusEnum.optional(),
      category: criticalActionCategoryEnum.optional(),
    });
    const queryParse = querySchema.safeParse(request.query);

    const list = await approvalService.listApprovalRequests(queryParse.success ? queryParse.data : undefined);
    return reply.send({ data: list });
  });
}
