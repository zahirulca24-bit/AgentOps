import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { permissionRoutes } from '../../src/modules/permission/permission.routes.js';

describe('Phase 3.7 — Permission Engine API Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(permissionRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Permission Evaluation API Lifecycle', () => {
    it('POST /api/v1/permissions/evaluate - evaluates Green tier safe read action as allow', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/permissions/evaluate',
        payload: {
          action: 'read_logs',
          actor: 'qa-auditor',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.tier).toBe('Green');
      expect(body.data.outcome).toBe('allow');
    });

    it('POST /api/v1/permissions/evaluate - evaluates Red tier critical action as human_approval_required', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/permissions/evaluate',
        payload: {
          action: 'deploy_production',
          actor: 'dev-user',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.tier).toBe('Red');
      expect(body.data.outcome).toBe('human_approval_required');
    });

    it('POST /api/v1/permissions/evaluate - applies default deny to unknown critical actions with HTTP 403', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/permissions/evaluate',
        payload: {
          action: 'purge_all_database_tables_unregistered',
          actor: 'bot',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.data.tier).toBe('Red');
      expect(body.data.outcome).toBe('deny');
    });

    it('GET /api/v1/permissions/rules - returns classification rules for Green, Yellow, and Red tiers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/permissions/rules',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.Green).toBeDefined();
      expect(body.data.Yellow).toBeDefined();
      expect(body.data.Red).toBeDefined();
      expect(body.data.Red).toContain('deploy_production');
      expect(body.data.Red).toContain('db_migration');
    });
  });
});
