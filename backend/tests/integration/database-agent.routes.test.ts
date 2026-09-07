import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { databaseAgentRoutes } from '../../src/modules/database/database-agent.routes.js';
import { approvalRoutes } from '../../src/modules/approval/approval.routes.js';

describe('Phase 3.10 — Database Agent Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(approvalRoutes);
    await app.register(databaseAgentRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/database/schema lists schema tables and column details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/database/schema',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.count).toBeGreaterThan(0);
    expect(body.tables.some((t: any) => t.tableName === 'projects')).toBe(true);
  });

  it('GET /api/v1/database/schema/:tableName inspects specific table', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/database/schema/projects',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.table.tableName).toBe('projects');
  });

  it('POST /api/v1/database/query executes SELECT query and applies row limit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/database/query',
      payload: {
        query: 'SELECT * FROM projects',
        actor: 'dev_user',
        maxRows: 1,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.queryResult.queryType).toBe('SELECT');
    expect(body.queryResult.rowCount).toBeLessThanOrEqual(1);
  });

  it('POST /api/v1/database/query blocks dangerous un-WHERE\'d DELETE query (HTTP 400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/database/query',
      payload: {
        query: 'DELETE FROM projects',
        actor: 'malicious_user',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    const message = body.message || body.error?.message || (typeof body.error === 'string' ? body.error : '');
    expect(message).toContain('WHERE clause');
  });
});
