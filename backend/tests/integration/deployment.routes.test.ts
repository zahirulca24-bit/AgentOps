import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/deployments/preview', () => {
    it('creates a Render preview deployment for a task branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/preview',
        payload: {
          provider: 'render',
          branchName: 'agentops/task-401',
          repoOwner: 'zahirulca24-bit',
          repoName: 'AgentOps',
          apiToken: 'rnd_secret_token_abc123',
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data).toBeDefined();
      expect(json.data.provider).toBe('render');
      expect(json.data.status).toBe('ready');
      expect(json.data.previewUrl).toContain('agentops-agentops-task-401.onrender.com');
      expect(JSON.stringify(json)).not.toContain('rnd_secret_token_abc123');
    });

    it('creates a Vercel preview deployment for a PR', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/preview',
        payload: {
          provider: 'vercel',
          branchName: 'feat/fix-navigation',
          prNumber: 42,
          apiToken: 'vercel_secret_token_xyz987',
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.provider).toBe('vercel');
      expect(json.data.status).toBe('ready');
      expect(json.data.prNumber).toBe(42);
      expect(json.data.previewUrl).toContain('agentops-feat-fix-navigation.vercel.app');
    });

    it('blocks preview deployments on default main branch with 403 FORBIDDEN', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/preview',
        payload: {
          provider: 'render',
          branchName: 'main',
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('FORBIDDEN');
      expect(json.error.message).toContain('strictly blocked');
    });

    it('handles simulated build failure with 422 status', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/preview',
        payload: {
          provider: 'render',
          branchName: 'feat/failed-build',
          simulateFailure: true,
        },
      });

      expect(response.statusCode).toBe(422);
      const json = response.json();
      expect(json.data.status).toBe('failed');
      expect(json.data.previewUrl).toBeNull();
      expect(json.data.errorDetails).toBeDefined();
    });
  });

  describe('GET /api/v1/deployments/preview/:id', () => {
    it('returns preview deployment status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deployments/preview/rnd_dep_12345?provider=render&branchName=agentops/task-501',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.provider).toBe('render');
      expect(json.data.status).toBe('ready');
      expect(json.data.previewUrl).toContain('agentops-agentops-task-501.onrender.com');
    });
  });

  describe('GET /api/v1/deployments/preview', () => {
    it('returns a list of preview deployments', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deployments/preview',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(Array.isArray(json.data)).toBe(true);
    });
  });
});
