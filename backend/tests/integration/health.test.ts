import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app/create-app.js';
import type { FastifyInstance } from 'fastify';

const testConfig = {
  NODE_ENV: 'test' as const,
  HOST: '127.0.0.1',
  PORT: 3001,
  LOG_LEVEL: 'silent' as const,
  CORS_ORIGINS: ['http://localhost:3000']
};

describe('Health and Readiness Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(testConfig);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 and { status: "ok" }', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
  });

  it('GET /ready returns 200 if DB is up, or 503 if DB is down', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ready'
    });

    if (response.statusCode === 200) {
      expect(JSON.parse(response.payload)).toEqual({ status: 'ready' });
    } else {
      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.payload)).toEqual({ status: 'error', message: 'Service unavailable' });
    }
  });
});

