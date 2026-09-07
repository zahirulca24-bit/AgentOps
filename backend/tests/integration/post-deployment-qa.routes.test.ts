import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { deploymentRoutes } from '../../src/modules/deployment/deployment.routes.js';

describe('Phase 3.3 — Post-Deployment QA API Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(deploymentRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/deployments/preview/:id/qa-run', () => {
    it('triggers post-deployment QA for a ready preview deployment and returns verdict', async () => {
      const deploymentId = 'dpl_preview_ready_505';

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/deployments/preview/${deploymentId}/qa-run`,
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.deploymentId).toBe(deploymentId);
      expect(body.data.verdict).toBe('PASS');
      expect(body.data.targetUrl).toContain(deploymentId.slice(0, 8));
      expect(body.data.runId).toBeDefined();
    });
  });

  describe('GET /api/v1/deployments/preview/:id/qa-status', () => {
    it('fetches post-deployment QA run status, evidence, and verdict summary', async () => {
      const deploymentId = 'dpl_preview_ready_606';

      // First trigger
      await app.inject({
        method: 'POST',
        url: `/api/v1/deployments/preview/${deploymentId}/qa-run`,
        payload: {},
      });

      // Get status
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/deployments/preview/${deploymentId}/qa-status`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.deploymentId).toBe(deploymentId);
      expect(body.data.status).toBe('completed');
      expect(body.data.verdict).toBe('PASS');
    });
  });
});
