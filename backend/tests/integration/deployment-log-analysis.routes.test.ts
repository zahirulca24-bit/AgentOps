import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { deploymentRoutes } from '../../src/modules/deployment/deployment.routes.js';

describe('Phase 3.2 — Deployment Log Analysis API Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(deploymentRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/deployments/analyze-logs', () => {
    it('analyzes raw deployment logs and returns structured analysis with severity and root cause', async () => {
      const payload = {
        logs: `
[BUILD LOGS] Checking out branch 'feat/broken'...
Error: Cannot find module 'express'
Command 'npm run build' exited with code 1.
`,
        branchName: 'feat/broken',
        provider: 'render',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/analyze-logs',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.outcome).toBe('FAIL');
      expect(body.data.overallSeverity).toBe('HIGH');
      expect(body.data.detectedErrors.length).toBeGreaterThan(0);
      expect(body.data.rootCause).toContain('MISSING_DEPENDENCY');
    });

    it('rejects analysis requests with empty logs payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/analyze-logs',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/deployments/preview with runId', () => {
    it('creates a preview deployment linked to a QA runId and returns embedded log analysis', async () => {
      const mockRunId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
      const payload = {
        provider: 'vercel',
        branchName: 'feat/preview-with-analysis',
        runId: mockRunId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/preview',
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.runId).toBe(mockRunId);
      expect(body.data.logAnalysis).toBeDefined();
      expect(body.data.logAnalysis.outcome).toBe('PASS');
    });
  });
});
