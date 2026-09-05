import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { apiRoutes } from '../../src/modules/api/api.routes.js';
import { createInMemoryDb } from '../../src/infrastructure/db/in-memory-db.js';
import type { AIProvider, StructuredQAContext } from '../../src/core/ai/provider.js';
import { issues, runs } from '../../src/infrastructure/db/schema.js';
import { AppError } from '../../src/core/errors.js';
import { redactString } from '../../src/infrastructure/redact/redactSensitive.js';
import crypto from 'crypto';

class MockAIProvider implements AIProvider {
  async generateStructuredQA<T>(_context: StructuredQAContext, _responseSchema: any): Promise<T> {
    return {
      explanation: 'Minimal targeted fix: Adjust z-index of checkout CTA button',
      changedFiles: ['src/components/CheckoutButton.tsx'],
      fileChanges: [
        {
          path: 'src/components/CheckoutButton.tsx',
          originalContent: 'export const CheckoutButton = () => <button className="z-10">Checkout</button>;',
          newContent: 'export const CheckoutButton = () => <button className="z-50">Checkout</button>;',
          diff: '--- src/components/CheckoutButton.tsx\n+++ src/components/CheckoutButton.tsx\n@@ -1 +1 @@\n-<button className="z-10">\n+<button className="z-50">',
        }
      ],
      riskNotes: ['Verify mobile viewports', 'Run regression suite']
    } as unknown as T;
  }
}

describe('Code Fix Engine Integration Routes (API)', () => {
  let app: FastifyInstance;
  let db: any;
  let mockAI: MockAIProvider;
  let testIssueId: string;

  beforeEach(async () => {
    db = createInMemoryDb();
    mockAI = new MockAIProvider();

    const testRunId = crypto.randomUUID();
    testIssueId = crypto.randomUUID();

    await db.insert(runs).values({
      id: testRunId,
      taskId: crypto.randomUUID(),
      status: 'failed',
    });

    await db.insert(issues).values({
      id: testIssueId,
      runId: testRunId,
      title: 'Checkout button occluded by overlay banner',
      description: 'CTA button intercepted by cookie overlay',
      severity: 'high',
      severityReason: 'Checkout flow blocked',
      category: 'functional',
      status: 'open',
      expectedResult: 'Checkout modal opens',
      actualResult: 'Click intercepted',
      affectedUrl: 'https://example.com/checkout',
      rootCauseAnalysis: {
        likelyCause: 'Sticky overlay occlusion',
        confidence: 'high',
        affectedArea: 'Frontend UI / Element Occlusion',
        suspectedComponent: 'src/components/CheckoutButton.tsx',
        recommendedNextAction: 'Increase CTA z-index',
        facts: ['Finding Title: Checkout button occluded'],
        inference: 'Cookie banner z-index higher than CTA button',
      }
    });

    app = fastify();

    app.setErrorHandler((error, request, reply) => {
      const errObj = error as any;
      if (error instanceof AppError || (errObj && errObj.code && errObj.statusCode)) {
        return reply.status(errObj.statusCode || 400).send({
          error: {
            code: errObj.code,
            message: redactString(errObj.message),
          }
        });
      }
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: error.message }
      });
    });

    await app.register(apiRoutes, {
      db,
      aiProvider: mockAI,
      browserManager: null as any,
      config: {} as any,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/issues/:id/fix', () => {
    it('generates a targeted code fix proposal for an issue on a task branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/issues/${testIssueId}/fix`,
        payload: {
          branchName: 'agentops/task-301',
          files: [
            {
              path: 'src/components/CheckoutButton.tsx',
              content: 'export const CheckoutButton = () => <button className="z-10">Checkout</button>;'
            }
          ]
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.proposal).toBeDefined();
      expect(body.data.proposal.issueId).toBe(testIssueId);
      expect(body.data.proposal.targetBranch).toBe('agentops/task-301');
      expect(body.data.proposal.fileChanges.length).toBe(1);
    });

    it('returns 403 FORBIDDEN when target branch is main', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/issues/${testIssueId}/fix`,
        payload: {
          branchName: 'main',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('strictly blocked');
    });

    it('returns 404 NOT_FOUND when issue does not exist', async () => {
      const missingId = crypto.randomUUID();
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/issues/${missingId}/fix`,
        payload: {
          branchName: 'agentops/task-302',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 VALIDATION_ERROR when branchName is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/issues/${testIssueId}/fix`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
