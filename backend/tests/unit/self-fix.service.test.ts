import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelfFixLoopService } from '../../src/modules/self-fix/self-fix.service.js';
import { RootCauseAnalysisService } from '../../src/modules/analysis/analysis.service.js';
import { CodeFixService } from '../../src/modules/fix/fix.service.js';
import { FixTestRunnerService } from '../../src/modules/runner/runner.service.js';
import { MockGitHubProvider } from '../../src/infrastructure/github/mock-github-provider.js';
import { AppError } from '../../src/core/errors.js';

describe('SelfFixLoopService - Unit Tests', () => {
  let mockDb: any;
  let mockAiProvider: any;
  let mockGitHubProvider: MockGitHubProvider;
  let rcaService: RootCauseAnalysisService;
  let codeFixService: CodeFixService;
  let testRunnerService: FixTestRunnerService;
  let selfFixService: SelfFixLoopService;

  const sampleIssueId = '11111111-1111-1111-1111-111111111111';
  const sampleRunId = '22222222-2222-2222-2222-222222222222';

  const mockIssueRecord = {
    id: sampleIssueId,
    runId: sampleRunId,
    title: 'Uncaught TypeError in session token refresh',
    description: 'Null pointer exception when refresh token is expired',
    severity: 'critical',
    category: 'auth',
    status: 'open',
    expectedResult: 'Graceful redirect to login',
    actualResult: 'HTTP 500 white screen crash',
    rootCauseAnalysis: {
      likelyCause: 'Missing optional chaining guard on session token refresh',
      suspectedComponent: 'src/auth/session.ts',
      recommendedNextAction: 'Add null check before reading refreshToken property',
      facts: ['Server returned 500 error'],
      inference: ['Session cookie expired'],
    },
  };

  beforeEach(() => {
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
      generateStructuredQA: vi.fn(),
    };

    rcaService = new RootCauseAnalysisService(mockDb, mockAiProvider);
    codeFixService = new CodeFixService(mockDb, mockAiProvider, mockGitHubProvider);

    // Mock executor for test runner
    const mockExecutor = vi.fn().mockResolvedValue({
      stdout: 'PASS tests/unit/auth.test.ts',
      stderr: '',
      exitCode: 0,
    });

    testRunnerService = new FixTestRunnerService(process.cwd(), mockExecutor);

    selfFixService = new SelfFixLoopService(
      mockDb,
      rcaService,
      codeFixService,
      testRunnerService,
      mockGitHubProvider
    );
  });

  describe('Task Branch Guard & Patch Deduplication', () => {
    it('rejects self-fixing loop execution targeting main or default branch directly', async () => {
      await expect(
        selfFixService.runSelfFixLoop({
          issueId: sampleIssueId,
          branchName: 'main',
        })
      ).rejects.toThrow('strictly blocked');
    });

    it('calculates deterministic patch signatures for deduplication', () => {
      const sig1 = selfFixService.calculatePatchSignature([
        { path: 'src/a.ts', newContent: 'const a = 1;' },
        { path: 'src/b.ts', newContent: 'const b = 2;' },
      ]);

      const sig2 = selfFixService.calculatePatchSignature([
        { path: 'src/b.ts', newContent: 'const b = 2;' },
        { path: 'src/a.ts', newContent: 'const a = 1;' },
      ]);

      expect(sig1).toBe(sig2);
    });
  });

  describe('Self-Fixing Loop Execution Scenarios', () => {
    it('completes loop with immediate success on 1st attempt when tests pass', async () => {
      mockAiProvider.generateStructuredQA.mockResolvedValueOnce({
        explanation: 'Add null check to refresh token handler',
        changedFiles: ['src/auth/session.ts'],
        fileChanges: [
          {
            path: 'src/auth/session.ts',
            newContent: 'export function refresh(token?: string) { return token?.trim() ?? null; }',
          },
        ],
        riskNotes: ['Low risk guard update'],
      });

      const result = await selfFixService.runSelfFixLoop({
        issueId: sampleIssueId,
        branchName: 'agentops/task-loop-1',
        githubRepo: {
          owner: 'octocat',
          repo: 'agentops-repo',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('fixed');
      expect(result.winningAttempt).toBe(1);
      expect(result.totalAttempts).toBe(1);
      expect(result.attempts[0].status).toBe('passed');
      expect(result.pullRequest).toBeDefined();
    });

    it('retries on 1st attempt test failure and succeeds on 2nd attempt', async () => {
      // 1st attempt fix proposal
      mockAiProvider.generateStructuredQA.mockResolvedValueOnce({
        explanation: 'Attempt 1: basic guard',
        changedFiles: ['src/auth/session.ts'],
        fileChanges: [{ path: 'src/auth/session.ts', newContent: 'const v1 = 1;' }],
        riskNotes: [],
      });

      // 2nd attempt fix proposal
      mockAiProvider.generateStructuredQA.mockResolvedValueOnce({
        explanation: 'Attempt 2: comprehensive session refresh guard',
        changedFiles: ['src/auth/session.ts'],
        fileChanges: [{ path: 'src/auth/session.ts', newContent: 'const v2 = 2;' }],
        riskNotes: [],
      });

      // Mock test runner executor: 1st fails, 2nd passes
      let testCallCount = 0;
      const failingAndPassingExecutor = vi.fn().mockImplementation(async () => {
        testCallCount++;
        if (testCallCount === 1) {
          return { stdout: '', stderr: 'FAIL tests/unit/auth.test.ts', exitCode: 1 };
        }
        return { stdout: 'PASS tests/unit/auth.test.ts', stderr: '', exitCode: 0 };
      });

      const customRunner = new FixTestRunnerService(process.cwd(), failingAndPassingExecutor);
      const customSelfFix = new SelfFixLoopService(
        mockDb,
        rcaService,
        codeFixService,
        customRunner,
        mockGitHubProvider
      );

      const result = await customSelfFix.runSelfFixLoop({
        issueId: sampleIssueId,
        branchName: 'agentops/task-loop-2',
        githubRepo: {
          owner: 'octocat',
          repo: 'agentops-repo',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('fixed');
      expect(result.winningAttempt).toBe(2);
      expect(result.totalAttempts).toBe(2);
      expect(result.attempts[0].status).toBe('failed');
      expect(result.attempts[1].status).toBe('passed');
    });

    it('detects and rejects duplicate failed patch proposals on subsequent attempts', async () => {
      // Both AI responses produce identical fileChanges
      mockAiProvider.generateStructuredQA.mockResolvedValue({
        explanation: 'Identical patch proposal',
        changedFiles: ['src/auth/session.ts'],
        fileChanges: [{ path: 'src/auth/session.ts', newContent: 'const duplicate = true;' }],
        riskNotes: [],
      });

      const failingExecutor = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: 'FAIL tests/unit/auth.test.ts',
        exitCode: 1,
      });

      const customRunner = new FixTestRunnerService(process.cwd(), failingExecutor);
      const customSelfFix = new SelfFixLoopService(
        mockDb,
        rcaService,
        codeFixService,
        customRunner,
        mockGitHubProvider
      );

      const result = await customSelfFix.runSelfFixLoop({
        issueId: sampleIssueId,
        branchName: 'agentops/task-loop-dedup',
        maxAttempts: 3,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('escalated');
      expect(result.attempts.length).toBe(3);
      expect(result.attempts[0].status).toBe('failed');
      expect(result.attempts[1].status).toBe('rejected_duplicate');
      expect(result.attempts[2].status).toBe('rejected_duplicate');
    });

    it('exhausts max 3 attempts on test failures and escalates to human engineer', async () => {
      let callIndex = 0;
      mockAiProvider.generateStructuredQA.mockImplementation(async () => {
        callIndex++;
        return {
          explanation: `Attempt ${callIndex} patch`,
          changedFiles: [`src/auth/file${callIndex}.ts`],
          fileChanges: [{ path: `src/auth/file${callIndex}.ts`, newContent: `const v${callIndex} = ${callIndex};` }],
          riskNotes: [],
        };
      });

      const failingExecutor = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: 'FAIL vitest run tests/unit/auth.test.ts',
        exitCode: 1,
      });

      const customRunner = new FixTestRunnerService(process.cwd(), failingExecutor);
      const customSelfFix = new SelfFixLoopService(
        mockDb,
        rcaService,
        codeFixService,
        customRunner,
        mockGitHubProvider
      );

      const result = await customSelfFix.runSelfFixLoop({
        issueId: sampleIssueId,
        branchName: 'agentops/task-loop-escalate',
        maxAttempts: 3,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('escalated');
      expect(result.winningAttempt).toBeNull();
      expect(result.totalAttempts).toBe(3);
      expect(result.escalationReason).toContain('Maximum fix attempts (3) reached');
      expect(result.escalationSummary).toContain('Human Escalation Report');
      expect(result.escalationSummary).toContain('Attempt 1');
      expect(result.escalationSummary).toContain('Attempt 2');
      expect(result.escalationSummary).toContain('Attempt 3');
    });
  });
});
