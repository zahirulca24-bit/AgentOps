import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app/create-app.js';
import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';

const testConfig = {
  NODE_ENV: 'test' as const,
  HOST: '127.0.0.1',
  PORT: 3001,
  LOG_LEVEL: 'silent' as const,
  CORS_ORIGINS: ['http://localhost:3000'],
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/agentops_test',
  AI_MODEL: 'gemini-2.5-flash'
};

describe('Phase-2 Bug / Finding Foundation API', () => {
  let app: FastifyInstance;
  let testRunId: string;
  let testSessionId: string;
  let testResultId: string;
  let createdBugId: string;

  beforeAll(async () => {
    app = await createApp(testConfig);
    await app.ready();
    testRunId = crypto.randomUUID();
    testSessionId = crypto.randomUUID();
    testResultId = crypto.randomUUID();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/issues creates a structured bug/finding with Phase-2 fields', async () => {
    const payload = {
      runId: testRunId,
      testResultId,
      browserSessionId: testSessionId,
      title: 'Checkout button unclickable on mobile view',
      description: 'The CTA button is occluded by sticky cookie banner',
      severity: 'high',
      category: 'functional',
      status: 'open',
      reproductionSteps: [
        'Navigate to https://example.com/cart',
        'Set viewport width to 375px',
        'Click #checkout-btn'
      ],
      expectedResult: 'Checkout modal opens within 500ms',
      actualResult: 'Click intercepted by #cookie-banner overlay',
      screenshotEvidence: ['evidence_snap_001.png'],
      consoleEvidence: ['console_err_001.json'],
      networkEvidence: ['net_log_001.json'],
      affectedUrl: 'https://example.com/cart'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      payload
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(body.data.runId).toBe(testRunId);
    expect(body.data.testResultId).toBe(testResultId);
    expect(body.data.browserSessionId).toBe(testSessionId);
    expect(body.data.title).toBe('Checkout button unclickable on mobile view');
    expect(body.data.severity).toBe('high');
    expect(body.data.status).toBe('open');
    expect(body.data.reproductionSteps).toEqual(payload.reproductionSteps);
    expect(body.data.expectedResult).toBe(payload.expectedResult);
    expect(body.data.actualResult).toBe(payload.actualResult);
    expect(body.data.screenshotEvidence).toEqual(['evidence_snap_001.png']);
    expect(body.data.consoleEvidence).toEqual(['console_err_001.json']);
    expect(body.data.networkEvidence).toEqual(['net_log_001.json']);

    createdBugId = body.data.id;
  });

  it('GET /api/v1/issues lists bugs and filters by status or severity', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/issues?runId=${testRunId}&severity=high`
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].id).toBe(createdBugId);
  });

  it('GET /api/v1/issues/:id retrieves specific bug details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/issues/${createdBugId}`
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.id).toBe(createdBugId);
    expect(body.data.title).toBe('Checkout button unclickable on mobile view');
  });

  it('PATCH /api/v1/issues/:id updates bug status (open -> investigating -> fixed -> closed)', async () => {
    // 1. Move to investigating
    const res1 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${createdBugId}`,
      payload: { status: 'investigating' }
    });
    expect(res1.statusCode).toBe(200);
    expect(JSON.parse(res1.payload).data.status).toBe('investigating');

    // 2. Move to fixed
    const res2 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${createdBugId}`,
      payload: { status: 'fixed', actualResult: 'Fixed by setting z-index on checkout CTA' }
    });
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res2.payload).data.status).toBe('fixed');
    expect(JSON.parse(res2.payload).data.actualResult).toBe('Fixed by setting z-index on checkout CTA');

    // 3. Move to closed
    const res3 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${createdBugId}`,
      payload: { status: 'closed' }
    });
    expect(res3.statusCode).toBe(200);
    expect(JSON.parse(res3.payload).data.status).toBe('closed');
  });

  it('POST /api/v1/issues automatically classifies severity and stores severityReason', async () => {
    const payload = {
      runId: testRunId,
      title: 'SQL Injection vulnerability in search bar',
      description: 'Input parameter "q" is not sanitized before query execution',
      securityImpact: 'high_risk',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      payload
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data.severity).toBe('critical');
    expect(body.data.severityReason).toBeDefined();
    expect(body.data.severityReason).toContain('security vulnerability');
  });

  it('POST /api/v1/issues/:id/analyze triggers root-cause analysis and persists result', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/issues/${createdBugId}/analyze`
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.analysis).toBeDefined();
    expect(body.data.analysis.likelyCause).toBeDefined();
    expect(body.data.analysis.confidence).toBeDefined();
    expect(Array.isArray(body.data.analysis.facts)).toBe(true);
    expect(body.data.analysis.inference).toBeDefined();
    expect(body.data.issue.rootCauseAnalysis).toBeDefined();
  });

  it('POST /api/v1/issues returns 400 for invalid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      payload: {
        title: 'Missing runId and severity'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
