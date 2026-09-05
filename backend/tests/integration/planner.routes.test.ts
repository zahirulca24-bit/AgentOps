import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app/create-app.js';
import type { FastifyInstance } from 'fastify';

const testConfig = {
  NODE_ENV: 'test' as const,
  HOST: '127.0.0.1',
  PORT: 3001,
  LOG_LEVEL: 'silent' as const,
  CORS_ORIGINS: ['http://localhost:3000'],
  DATABASE_URL: 'postgresql://user:pass@test-host:5432/testdb',
  AI_MODEL: 'gemini-2.5-flash'
};

describe('Planner Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(testConfig);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/tasks/:taskId/plan returns 400 for invalid UUID', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/not-a-uuid/plan'
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid task ID format');
  });

  // Since we cannot run DB queries against a dummy host, we won't test a successful 
  // execution against the live route. The logic is fully covered in planner.service.test.ts
});
