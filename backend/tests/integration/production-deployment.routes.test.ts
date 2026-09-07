import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { deploymentRoutes } from '../../src/modules/deployment/deployment.routes.js';

describe('Phase 3.4 — Production Deployment API Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(deploymentRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Production Deployment Lifecycle via HTTP API', () => {
    let productionDeploymentId: string;

    it('POST /api/v1/deployments/production/request - creates a production deployment request', async () => {
      const payload = {
        previewDeploymentId: 'dpl_preview_ready_api_1',
        provider: 'render',
        branchName: 'agentops/task-api-prod',
        requestedBy: 'dev@agentops.ai',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/production/request',
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.approvalStatus).toBe('pending');
      expect(body.data.status).toBe('pending_approval');
      productionDeploymentId = body.data.productionDeploymentId;
    });

    it('POST /api/v1/deployments/production/approve - records human approval', async () => {
      const payload = {
        productionDeploymentId,
        approvedBy: 'lead-approver@agentops.ai',
        decision: 'approved',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/production/approve',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.approvalStatus).toBe('approved');
      expect(body.data.approvedBy).toBe('lead-approver@agentops.ai');
    });

    it('POST /api/v1/deployments/production/deploy - executes approved production deployment', async () => {
      const payload = {
        productionDeploymentId,
        apiToken: 'secret_prod_token',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/production/deploy',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.status).toBe('live');
      expect(body.data.productionUrl).toBeDefined();
      expect(body.data.buildLogs).not.toContain('secret_prod_token');
    });

    it('GET /api/v1/deployments/production/:id - returns production deployment details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/deployments/production/${productionDeploymentId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.productionDeploymentId).toBe(productionDeploymentId);
      expect(body.data.status).toBe('live');
    });
  });
});
