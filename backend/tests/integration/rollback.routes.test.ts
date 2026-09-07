import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { deploymentRoutes } from '../../src/modules/deployment/deployment.routes.js';

describe('Phase 3.5 — Rollback API Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(deploymentRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Rollback API Lifecycle', () => {
    let rollbackId: string;

    it('POST /api/v1/deployments/rollback/auto - triggers automatic rollback', async () => {
      const payload = {
        targetProductionId: 'prod_dep_failed_auto',
        reason: 'Automated container exit with code 1',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/rollback/auto',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.mode).toBe('automatic');
      rollbackId = body.data.rollbackId;
    });

    it('POST /api/v1/deployments/rollback/manual - triggers manual rollback with human approval', async () => {
      const payload = {
        targetProductionId: 'prod_dep_failed_manual',
        initiatedBy: 'qa-engineer@agentops.ai',
        approvedBy: 'infra-lead@agentops.ai',
        reason: 'Reverting due to 500 errors on API routes',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/rollback/manual',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.mode).toBe('manual');
      expect(body.data.status).toBe('restored');
      expect(body.data.approvedBy).toBe('infra-lead@agentops.ai');
    });

    it('GET /api/v1/deployments/rollback/stable - fetches previous stable deployment details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deployments/rollback/stable',
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /api/v1/deployments/rollback/:id - returns rollback status details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/deployments/rollback/${rollbackId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.rollbackId).toBe(rollbackId);
    });
  });
});
