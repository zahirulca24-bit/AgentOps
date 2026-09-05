import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { selfFixRoutes } from '../../src/modules/self-fix/self-fix.routes.js';
import { SelfFixLoopService } from '../../src/modules/self-fix/self-fix.service.js';
import { RootCauseAnalysisService } from '../../src/modules/analysis/analysis.service.js';
import { CodeFixService } from '../../src/modules/fix/fix.service.js';
import { FixTestRunnerService } from '../../src/modules/runner/runner.service.js';
import { MockGitHubProvider } from '../../src/infrastructure/github/mock-github-provider.js';
import { AppError } from '../../src/core/errors.js';
import { redactString } from '../../src/infrastructure/redact/redactSensitive.js';

describe('Self-Fixing Loop Integration Routes (API)', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let mockAiProvider: any;
  let mockGitHubProvider: MockGitHubProvider;

  const sampleIssueId = '33333333-3333-3333-3333-333333333333';
  const sampleRunId = '44444444-4444-4444-4444-444444444444';

  const mockIssueRecord = {
    id: sampleIssueId,
    runId: sampleRunId,
    title: 'Authentication token expiration crash',
    description: 'Expired token causes 500 error',
    severity: 'high',
    category: 'auth',
    status: 'open',
    expectedResult: 'Redirect to login',
    actualResult: 'HTTP 500',
    rootCauseAnalysis: {
      likelyCause: 'Unchecked token parse exception',
      recommendedNextAction: 'Add try-catch in token parser',
    },
  };

  beforeEach(async () => {
    mockGitHubProvider = new MockGitHubProvider();

    mockDb = {
      query: {
        issues: {
          findFirst: vi.fn().mockResolvedValue(mockIssueRecord),
        },
        runs: {
          findFirst: vi.fn().mockResolvedValue({ id: sampleRunId, status: 'completed' }),
        },
        evidence: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    mockAiProvider = {
      generateStructuredQA: vi.fn().mockResolvedValue({
        explanation: 'Add try-catch block for expired token handling',
        changedFiles: ['src/auth.ts'],
        fileChanges: [{ path: 'src/auth.ts', newContent: 'try { parseToken(); } catch { redirect(); }' }],
        riskNotes: [],
      }),
    };

    const rcaService = new RootCauseAnalysisService(mockDb, mockAiProvider);
    const codeFixService = new CodeFixService(mockDb, mockAiProvider, mockGitHubProvider);
    const passingExecutor = vi.fn().mockResolvedValue({
      stdout: 'PASS tests/unit/auth.test.ts',
      stderr: '',
      exitCode: 0,
    });
    const runnerService = new FixTestRunnerService(process.cwd(), passingExecutor);

    const selfFixService = new SelfFixLoopService(
      mockDb,
      rcaService,
      codeFixService,
      runnerService,
      mockGitHubProvider
    );

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

    await app.register(selfFixRoutes, {
      prefix: '/api/v1/issues',
      service: selfFixService,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/issues/:id/self-fix', () => {
    it('executes self-fixing loop and returns structured loop result', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/issues/${sampleIssueId}/self-fix`,
        payload: {
          branchName: 'agentops/task-api-fix-1',
          githubRepo: {
            owner: 'octocat',
            repo: 'agentops-repo',
            token: 'ghp_validToken1234567890abcdef',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.loopResult.success).toBe(true);
      expect(body.data.loopResult.status).toBe('fixed');
      expect(body.data.loopResult.winningAttempt).toBe(1);
    });

    it('returns 403 FORBIDDEN when attempting self-fix directly on main branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/issues/${sampleIssueId}/self-fix`,
        payload: {
          branchName: 'main',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('strictly blocked');
    });
  });
});
