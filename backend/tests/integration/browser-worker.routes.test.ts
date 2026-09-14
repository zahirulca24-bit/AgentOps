import fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/core/errors.js';
import { browserWorkerRoutes } from '../../src/modules/browser-workers/browser-worker.routes.js';

const workerId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';

async function makeApp(service: any) {
  const app = fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  });
  await app.register(browserWorkerRoutes, { service });
  await app.ready();
  return app;
}

function serviceMock() {
  const worker = { id: workerId, projectId, name: 'Manual Worker', status: 'idle' };
  return {
    listWorkers: vi.fn(async () => [worker]),
    createWorker: vi.fn(async () => worker),
    getWorker: vi.fn(async () => worker),
    updateWorker: vi.fn(async () => ({ ...worker, name: 'Updated Worker' })),
    triggerWorker: vi.fn(async () => ({ id: '33333333-3333-4333-8333-333333333333', workerId, status: 'running' })),
    pauseWorker: vi.fn(async () => ({ ...worker, status: 'paused' })),
    resumeWorker: vi.fn(async () => worker),
    getHistory: vi.fn(async () => [{ id: '44444444-4444-4444-8444-444444444444', workerId, status: 'passed' }]),
    listNotifications: vi.fn(async () => [{ id: '55555555-5555-4555-8555-555555555555', workerId, title: 'Failure' }]),
    markAllNotificationsRead: vi.fn(async () => undefined),
  };
}

describe('manual Browser Worker routes', () => {
  it('supports list, create, update, pause/resume, run, history and notifications without AI calls', async () => {
    const service = serviceMock();
    const app = await makeApp(service);

    expect((await app.inject({ method: 'GET', url: '/api/v1/browser-workers' })).statusCode).toBe(200);

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/browser-workers',
      payload: {
        projectId,
        name: 'Manual Worker',
        environment: 'staging',
        targetUrl: 'https://example.com',
        scheduleType: 'on_demand',
        workflow: [{ type: 'navigate', url: 'https://example.com' }],
      },
    });
    expect(created.statusCode).toBe(201);
    expect(service.createWorker).toHaveBeenCalledOnce();

    expect((await app.inject({ method: 'PATCH', url: `/api/v1/browser-workers/${workerId}`, payload: { name: 'Updated Worker' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/v1/browser-workers/${workerId}/pause` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/v1/browser-workers/${workerId}/resume` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/v1/browser-workers/${workerId}/run` })).statusCode).toBe(202);
    expect(service.triggerWorker).toHaveBeenCalledWith(workerId, 'manual', true);
    expect((await app.inject({ method: 'GET', url: `/api/v1/browser-workers/${workerId}/history` })).statusCode).toBe(200);

    const notifications = await app.inject({ method: 'GET', url: '/api/v1/browser-worker-notifications?unreadOnly=true' });
    expect(notifications.statusCode).toBe(200);
    expect(service.listNotifications).toHaveBeenCalledWith(true);

    await app.close();
  });

  it('returns a safe structured 503 when Browser Worker tables are unavailable', async () => {
    const service = serviceMock();
    const dbError: any = new Error('relation browser_workers does not exist; password=super-secret');
    dbError.code = '42P01';
    service.listWorkers.mockRejectedValueOnce(dbError);
    const app = await makeApp(service);

    const response = await app.inject({ method: 'GET', url: '/api/v1/browser-workers' });
    expect(response.statusCode).toBe(503);
    const body = response.json();
    expect(body.error.code).toBe('BROWSER_WORKER_STORAGE_UNAVAILABLE');
    expect(body.error.message).toBe('Browser Worker storage is not ready. Required database migrations must be applied.');
    expect(response.payload).not.toContain('super-secret');
    expect(response.payload).not.toContain('browser_workers does not exist');

    await app.close();
  });
});
