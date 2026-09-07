import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { approvalRoutes } from '../../src/modules/approval/approval.routes.js';

describe('Phase 3.6 — Human Approval API Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(approvalRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Human Approval HTTP Lifecycle', () => {
    let approvalId: string;

    it('POST /api/v1/approvals/request - creates a critical action approval request', async () => {
      const payload = {
        actionCategory: 'SECURITY_CREDENTIAL_ROTATION',
        actionSummary: 'Rotate production database master password and API keys',
        requestedBy: 'sec-ops@agentops.ai',
        resourceId: 'vault_prod_credentials',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/approvals/request',
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.status).toBe('pending');
      expect(body.data.actionCategory).toBe('SECURITY_CREDENTIAL_ROTATION');
      approvalId = body.data.approvalId;
    });

    it('POST /api/v1/approvals/:id/approve - grants approval and resumes execution state', async () => {
      const payload = {
        actor: 'cso@agentops.ai',
        reason: 'Credential rotation approved during maintenance window',
      };

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approvalId}/approve`,
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.status).toBe('approved');
      expect(body.data.approvedBy).toBe('cso@agentops.ai');
    });

    it('GET /api/v1/approvals/:id - retrieves approval request details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approvalId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.approvalId).toBe(approvalId);
      expect(body.data.status).toBe('approved');
    });

    it('GET /api/v1/approvals - lists approval requests filtered by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals?status=approved',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });
});
