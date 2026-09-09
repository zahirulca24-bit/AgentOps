import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors.js';
import type { BrowserWorkerService } from './browser-worker.service.js';

const idSchema = z.object({ id: z.string().uuid() });
const scheduleSchema = z.enum(['on_demand', 'hourly', 'daily', 'weekly']);
const loginConfigSchema = z.object({
  loginUrl: z.string().min(1).max(2048),
  usernameSelector: z.string().min(1).max(512),
  passwordSelector: z.string().min(1).max(512),
  submitSelector: z.string().min(1).max(512),
  logoutSelector: z.string().min(1).max(512).optional(),
});

const workflowStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('login') }),
  z.object({ type: z.literal('navigate'), url: z.string().min(1).max(2048) }),
  z.object({ type: z.literal('click'), selector: z.string().min(1).max(512) }),
  z.object({ type: z.literal('fill'), selector: z.string().min(1).max(512), value: z.string().max(2048) }),
  z.object({ type: z.literal('submit'), selector: z.string().min(1).max(512) }),
  z.object({ type: z.literal('wait'), timeoutMs: z.number().int().min(0).max(30_000).optional() }),
  z.object({ type: z.literal('logout'), selector: z.string().min(1).max(512).optional() }),
]);

const createWorkerSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  environment: z.string().trim().min(1).max(64),
  targetUrl: z.string().url().optional(),
  scheduleType: scheduleSchema.default('on_demand'),
  credentialSecretRef: z.string().trim().min(3).max(255).nullable().optional(),
  loginConfig: loginConfigSchema.nullable().optional(),
  workflow: z.array(workflowStepSchema).max(50).optional(),
}).superRefine((value, ctx) => {
  if (value.credentialSecretRef && !value.loginConfig) {
    ctx.addIssue({ code: 'custom', path: ['loginConfig'], message: 'loginConfig is required with credentialSecretRef' });
  }
});

const updateWorkerSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  environment: z.string().trim().min(1).max(64).optional(),
  targetUrl: z.string().url().optional(),
  scheduleType: scheduleSchema.optional(),
  credentialSecretRef: z.string().trim().min(3).max(255).nullable().optional(),
  loginConfig: loginConfigSchema.nullable().optional(),
  workflow: z.array(workflowStepSchema).max(50).optional(),
});

function parseId(request: FastifyRequest): string {
  const parsed = idSchema.safeParse(request.params);
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid Browser Worker ID', 400);
  return parsed.data.id;
}

export async function browserWorkerRoutes(
  app: FastifyInstance,
  options: { service: BrowserWorkerService },
) {
  const { service } = options;

  app.get('/api/v1/browser-workers', async (_request, reply) => {
    return reply.send({ data: await service.listWorkers() });
  });

  app.post('/api/v1/browser-workers', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createWorkerSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid Browser Worker payload', 400);
    const worker = await service.createWorker(parsed.data);
    return reply.status(201).send({ data: worker });
  });

  app.get('/api/v1/browser-workers/:id', async (request, reply) => {
    return reply.send({ data: await service.getWorker(parseId(request)) });
  });

  app.patch('/api/v1/browser-workers/:id', async (request, reply) => {
    const parsed = updateWorkerSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid Browser Worker update', 400);
    return reply.send({ data: await service.updateWorker(parseId(request), parsed.data) });
  });

  app.post('/api/v1/browser-workers/:id/run', async (request, reply) => {
    const run = await service.triggerWorker(parseId(request), 'manual', true);
    return reply.status(202).send({ data: run });
  });

  app.post('/api/v1/browser-workers/:id/pause', async (request, reply) => {
    return reply.send({ data: await service.pauseWorker(parseId(request)) });
  });

  app.post('/api/v1/browser-workers/:id/resume', async (request, reply) => {
    return reply.send({ data: await service.resumeWorker(parseId(request)) });
  });

  app.get('/api/v1/browser-workers/:id/history', async (request, reply) => {
    return reply.send({ data: await service.getHistory(parseId(request)) });
  });

  app.get('/api/v1/browser-worker-notifications', async (request, reply) => {
    const query = request.query as { unreadOnly?: string } | undefined;
    return reply.send({ data: await service.listNotifications(query?.unreadOnly === 'true') });
  });

  app.post('/api/v1/browser-worker-notifications/read-all', async (_request, reply) => {
    await service.markAllNotificationsRead();
    return reply.send({ data: { success: true } });
  });
}
