import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app/create-app.js';
import type { EnvConfig } from '../../src/config/env.js';

const testConfig: EnvConfig = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3001,
  LOG_LEVEL: 'silent',
  CORS_ORIGINS: ['http://localhost:3000'],
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/agentops_test',
  AI_MODEL: 'gemini-3.6-flash',
};

describe('Phase 3.1 — Preview Deployment API Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(testConfig);
    await app.ready();
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => app.close());

  it('creates a Vercel preview using provider response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'dpl_route_1',
      readyState: 'READY',
      url: 'agentops-preview.vercel.app',
      createdAt: Date.now(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments/preview',
      payload: {
        provider: 'vercel',
        branchName: 'feat/fix-navigation',
        prNumber: 42,
        repoOwner: 'zahirulca24-bit',
        repoName: 'AgentOps',
        projectId: 'prj_test',
        apiToken: 'vercel_secret_token_xyz987',
      },
    });

    expect(response.statusCode).toBe(201);
    const json = response.json();
    expect(json.data.status).toBe('ready');
    expect(json.data.previewUrl).toBe('https://agentops-preview.vercel.app');
    expect(JSON.stringify(json)).not.toContain('vercel_secret_token_xyz987');
  });

  it('does not claim Render Git preview success without imageUrl', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments/preview',
      payload: {
        provider: 'render',
        branchName: 'agentops/task-401',
        apiToken: 'rnd_secret_token_abc123',
        serviceId: 'srv_test',
      },
    });

    expect(response.statusCode).toBe(422);
    const json = response.json();
    expect(json.data.status).toBe('failed');
    expect(json.data.errorDetails).toContain('image-backed services');
    expect(JSON.stringify(json)).not.toContain('rnd_secret_token_abc123');
  });

  it('blocks preview deployments on main', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments/preview',
      payload: { provider: 'render', branchName: 'main' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('handles explicit simulated provider failure with 422', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments/preview',
      payload: { provider: 'render', branchName: 'feat/failed-build', simulateFailure: true },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().data.status).toBe('failed');
  });

  it('lists preview deployments', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/deployments/preview' });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().data)).toBe(true);
  });
});
