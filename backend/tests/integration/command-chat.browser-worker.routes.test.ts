import fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { AIProvider } from '../../src/core/ai/provider.js';
import { commandChatRoutes } from '../../src/modules/command-chat/command-chat.routes.js';

const projectId = '11111111-1111-4111-8111-111111111111';

const aiProvider: AIProvider = {
  generateStructuredQA: async () => ({
    intent: 'browser_worker_create',
    summary: 'Create a daily checkout monitor',
    browserWorker: {
      projectId,
      targetUrl: 'https://app.example.com',
      name: 'Checkout monitor',
      environment: 'test',
      scheduleType: 'daily',
      checks: [{ type: 'navigate', url: '/checkout' }],
    },
  }),
};

describe('command chat Browser Worker execution', () => {
  it('creates the worker through the Browser Worker service and returns its id/status', async () => {
    const createWorker = vi.fn(async (input: any) => ({
      id: '22222222-2222-4222-8222-222222222222',
      status: 'idle',
      scheduleType: input.scheduleType,
      name: input.name,
    }));
    const app = fastify();
    await app.register(commandChatRoutes, {
      aiProvider,
      browserWorkerService: { createWorker } as any,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/command-chat/dispatch',
      payload: { command: 'Create a daily browser worker for checkout', context: { page: '/automation' } },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.intent).toBe('browser_worker_create');
    expect(body.data.specialist).toBe('Browser Worker');
    expect(body.data.status).toBe('executed');
    expect(body.data.worker).toEqual(expect.objectContaining({
      id: '22222222-2222-4222-8222-222222222222',
      status: 'idle',
      scheduleType: 'daily',
    }));
    expect(createWorker).toHaveBeenCalledOnce();

    await app.close();
  });
});
