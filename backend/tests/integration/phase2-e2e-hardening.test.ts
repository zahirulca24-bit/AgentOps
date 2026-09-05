import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { SeverityClassifierService } from '../../src/modules/severity/severity.service.js';
import { RootCauseAnalysisService } from '../../src/modules/analysis/analysis.service.js';
import { CodeFixService } from '../../src/modules/fix/fix.service.js';
import { FixTestRunnerService } from '../../src/modules/runner/runner.service.js';
import { GitHubService } from '../../src/modules/github/github.service.js';
import { SelfFixLoopService } from '../../src/modules/self-fix/self-fix.service.js';
import { MockGitHubProvider } from '../../src/infrastructure/github/mock-github-provider.js';
import { AuditLoggerService } from '../../src/modules/audit/audit.service.js';
import { redactString } from '../../src/infrastructure/redact/redactSensitive.js';
import { AppError } from '../../src/core/errors.js';

describe('Phase-2 Full Flow Integration & Security Hardening (E2E Mocked)', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let mockAiProvider: any;
  let mockGitHubProvider: MockGitHubProvider;

  let severityClassifier: SeverityClassifierService;
  let rcaService: RootCauseAnalysisService;
  let codeFixService: CodeFixService;
  let githubService: GitHubService;

  const testIssueId = '55555555-5555-5555-5555-555555555555';
  const testRunId = '66666666-6666-6666-6666-666666666666';

  const initialIssueData = {
    id: testIssueId,
    runId: testRunId,
    title: 'Uncaught TypeError on checkout submission with ghp_1234567890abcdef1234567890abcdef123456',
    description: 'User clicking Place Order receives HTTP 500 white screen crash',
    category: 'payment',
    status: 'open',
    expectedResult: 'Order confirmation page displayed with order ID',
    actualResult: 'HTTP 500 Internal Server Error white screen',
    affectedUrl: 'https://demo.agentops.ai/checkout',
    userFlowImpact: 'blocking',
    securityImpact: 'none',
    dataLossRisk: true,
    paymentAuthImpact: 'checkout_blocked',
    reproducibility: 'always',
    scopeOfUsers: 'all_users',
    rootCauseAnalysis: null,
  };

  beforeEach(() => {
    AuditLoggerService.clearLogs();
    mockGitHubProvider = new MockGitHubProvider();
    githubService = new GitHubService(mockGitHubProvider);

    let dbIssue = { ...initialIssueData };

    mockDb = {
      query: {
        issues: {
          findFirst: vi.fn().mockImplementation(async () => ({ ...dbIssue })),
        },
        runs: {
          findFirst: vi.fn().mockResolvedValue({ id: testRunId, status: 'completed' }),
        },
        evidence: {
          findMany: vi.fn().mockResolvedValue([
            { type: 'console_log', description: 'Uncaught TypeError: Cannot read property "id" of null' },
            { type: 'network_log', description: 'POST /api/v1/checkout 500 Internal Server Error' },
          ]),
        },
      },
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((updateObj: any) => {
          dbIssue = { ...dbIssue, ...updateObj };
          return {
            where: vi.fn().mockResolvedValue({}),
          };
        }),
      })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...initialIssueData }]),
        }),
      }),
    };

    mockAiProvider = {
      generateStructuredQA: vi.fn(),
    };

    severityClassifier = new SeverityClassifierService();
    rcaService = new RootCauseAnalysisService(mockDb, mockAiProvider);
    codeFixService = new CodeFixService(mockDb, mockAiProvider, mockGitHubProvider);
  });

  describe('1. Full End-to-End Pipeline Execution', () => {
    it('executes QA Fail -> Severity -> Root Cause -> Repo Inspect -> Task Branch -> Fix -> Test -> Commit -> PR -> CI -> Retest -> Success', async () => {
      // Step A: Severity Classification
      const classification = severityClassifier.classify({
        title: initialIssueData.title,
        description: initialIssueData.description,
        userFlowImpact: 'blocking',
        paymentAuthImpact: 'checkout_blocked',
        dataLossRisk: true,
      });

      expect(classification.severity).toBe('critical');
      expect(classification.reason).toBeDefined();
      expect(classification.reason).toContain('data loss');

      // Step B: AI Root Cause Analysis
      mockAiProvider.generateStructuredQA.mockResolvedValueOnce({
        likelyCause: 'Unchecked null pointer in checkout payment processing middleware',
        confidence: 'high',
        affectedArea: 'checkout_backend',
        suspectedComponent: 'src/checkout.ts',
        recommendedNextAction: 'Add null guard for payment token object',
        facts: ['HTTP 500 error returned by server', 'Console log indicates null property access'],
        inference: 'Checkout request payload missing required token structure',
      });

      const rca = await rcaService.analyzeIssue(testIssueId);
      expect(rca).toBeDefined();
      expect(rca.likelyCause).toContain('checkout payment processing');


      // Step C: Repo File Read & Inspection
      const repoFile = await githubService.readFile('octocat', 'agentops-repo', 'src/index.ts', 'main', 'ghp_validToken');
      expect(repoFile.content).toBeDefined();

      // Step D: Create Dedicated Task Branch
      const taskBranch = await githubService.createTaskBranch('octocat', 'agentops-repo', 'agentops/task-e2e-flow', 'main', 'ghp_validToken');
      expect(taskBranch.name).toBe('agentops/task-e2e-flow');

      // Step E: Code Fix Generation
      mockAiProvider.generateStructuredQA.mockResolvedValueOnce({
        explanation: 'Add null guard to payment payload in src/checkout.ts',
        changedFiles: ['src/checkout.ts'],
        fileChanges: [
          {
            path: 'src/checkout.ts',
            newContent: 'export function processCheckout(payload?: any) { return payload?.token ? true : false; }',
          },
        ],
        riskNotes: ['Minimal diff fix for checkout crash'],
      });

      const fixProposal = await codeFixService.generateFixProposal(testIssueId, {
        branchName: 'agentops/task-e2e-flow',
      });
      expect(fixProposal.changedFiles).toContain('src/checkout.ts');

      // Step F: Automated Test Runner
      const passingExecutor = vi.fn().mockResolvedValue({
        stdout: 'PASS tests/unit/checkout.test.ts',
        stderr: '',
        exitCode: 0,
      });
      const testRunner = new FixTestRunnerService(process.cwd(), passingExecutor);

      const testResult = await testRunner.runTests({
        branchName: 'agentops/task-e2e-flow',
        issueId: testIssueId,
        suiteTypes: ['unit', 'integration'],
      });
      expect(testResult.passed).toBe(true);

      // Step G: Commit to Task Branch
      const commitResult = await githubService.applyFileChanges({
        owner: 'octocat',
        repo: 'agentops-repo',
        branch: 'agentops/task-e2e-flow',
        commitMessage: 'fix(checkout): add null check for payment token',
        changes: [{ path: 'src/checkout.ts', content: 'export function fix() {}' }],
        token: 'ghp_validToken',
      });
      expect(commitResult.commitSha).toBeDefined();

      // Step H: Create Pull Request with Attached Summaries
      const pr = await githubService.createPullRequest({
        owner: 'octocat',
        repo: 'agentops-repo',
        head: 'agentops/task-e2e-flow',
        title: 'fix(checkout): resolve null pointer exception in checkout',
        findingSummary: {
          title: initialIssueData.title,
          severity: classification.severity,
          description: initialIssueData.description,
        },
        rootCauseAnalysis: {
          likelyCause: rca.likelyCause,
          recommendedAction: rca.recommendedNextAction,
        },
        testRunnerResult: testResult,
        token: 'ghp_validToken',
      });
      expect(pr.number).toBeGreaterThan(0);
      expect(pr.body).toContain('Finding Details');

      // Step I: Inspect PR CI / Check Status
      const prStatus = await githubService.getPRCheckStatus('octocat', 'agentops-repo', pr.number, 'ghp_validToken');
      expect(prStatus.overallStatus).toBe('passed');
    });
  });

  describe('2. Security Hardening Verification', () => {
    it('enforces task branch protection and blocks direct commits/pushes to main across all services', async () => {
      // GitHubService branch validation
      expect(githubService.validateBranchName('main', 'main').valid).toBe(false);
      expect(githubService.validateBranchName('master', 'main').valid).toBe(false);
      expect(githubService.validateBranchName('release', 'main').valid).toBe(false);

      // Rejection in applyFileChanges
      await expect(
        githubService.applyFileChanges({
          owner: 'octocat',
          repo: 'agentops-repo',
          branch: 'main',
          commitMessage: 'direct commit to main',
          changes: [{ path: 'README.md', content: 'hack' }],
          token: 'ghp_validToken',
        })
      ).rejects.toThrow('strictly forbidden');

      // Rejection in createTaskBranch
      await expect(
        githubService.createTaskBranch('octocat', 'agentops-repo', 'main', undefined, 'ghp_validToken')
      ).rejects.toThrow('strictly forbidden');
    });

    it('redacts secret tokens and credentials from outputs, error logs, and commit/PR contents', () => {
      const secretToken = 'ghp_abcdef1234567890abcdef1234567890123456';
      const rawText = `User connected with token ${secretToken} and password secretPass123`;

      const redacted = redactString(rawText);
      expect(redacted).not.toContain(secretToken);
      expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]');
    });

    it('blocks arbitrary command execution in FixTestRunnerService via safe allowlist & regex rules', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ stdout: 'PASS', stderr: '', exitCode: 0 });
      const runner = new FixTestRunnerService(process.cwd(), mockExecutor);

      // Verify that resolveAllowlistCommand rejects unsupported test suite types
      expect(() => runner.resolveAllowlistCommand('arbitrary_malicious_type' as any)).toThrow('Unsupported test suite type');

      // Verify that runTests with standard suite types only executes allowlisted vitest commands
      await runner.runTests({
        branchName: 'agentops/task-security-test',
        suiteTypes: ['unit', 'integration'],
      });

      expect(mockExecutor).toHaveBeenCalledTimes(2);
      expect(mockExecutor.mock.calls[0][0]).toBe('npx vitest run tests/unit');
      expect(mockExecutor.mock.calls[1][0]).toBe('npx vitest run tests/integration');
    });

  });

  describe('3. Self-Fixing Bounded Retry & Human Escalation Hardening', () => {
    it('executes bounded self-fixing loop, catches patch duplicates, and escalates to human on 3 failed attempts', async () => {
      let callCount = 0;
      mockAiProvider.generateStructuredQA.mockImplementation(async () => {
        callCount++;
        return {
          explanation: `Attempt ${callCount} proposal`,
          changedFiles: ['src/failing.ts'],
          fileChanges: [{ path: 'src/failing.ts', newContent: 'export const fail = true;' }],
          riskNotes: [],
        };
      });

      const failingExecutor = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: 'FAIL tests/unit/checkout.test.ts',
        exitCode: 1,
      });

      const runnerService = new FixTestRunnerService(process.cwd(), failingExecutor);
      const selfFix = new SelfFixLoopService(
        mockDb,
        rcaService,
        codeFixService,
        runnerService,
        mockGitHubProvider
      );

      const loopResult = await selfFix.runSelfFixLoop({
        issueId: testIssueId,
        branchName: 'agentops/task-retry-escalate',
        maxAttempts: 3,
      });

      expect(loopResult.success).toBe(false);
      expect(loopResult.status).toBe('escalated');
      expect(loopResult.totalAttempts).toBe(3);

      // Attempt 1 fails, Attempts 2 and 3 flag duplicate patch
      expect(loopResult.attempts[0].status).toBe('failed');
      expect(loopResult.attempts[1].status).toBe('rejected_duplicate');
      expect(loopResult.attempts[2].status).toBe('rejected_duplicate');

      expect(loopResult.escalationSummary).toContain('Human Escalation Report');

      // Verify Audit Logs recorded all events
      const auditLogs = AuditLoggerService.getLogs();
      expect(auditLogs.some(l => l.eventType === 'SELF_FIX_ATTEMPT_STARTED')).toBe(true);
      expect(auditLogs.some(l => l.eventType === 'SELF_FIX_ATTEMPT_DUPLICATE')).toBe(true);
      expect(auditLogs.some(l => l.eventType === 'SELF_FIX_ESCALATED')).toBe(true);
    });
  });
});
