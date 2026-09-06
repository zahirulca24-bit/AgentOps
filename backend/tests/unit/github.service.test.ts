import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubService } from '../../src/modules/github/github.service.js';
import { MockGitHubProvider } from '../../src/infrastructure/github/mock-github-provider.js';
import { GitHubError } from '../../src/modules/github/github.errors.js';
import { redactString } from '../../src/infrastructure/redact/redactSensitive.js';

describe('GitHubService - Unit Tests with Mocked GitHub Provider', () => {
  let mockProvider: MockGitHubProvider;
  let service: GitHubService;

  beforeEach(() => {
    mockProvider = new MockGitHubProvider();
    service = new GitHubService(mockProvider);
  });

  describe('Token Validation', () => {
    it('validates a valid GitHub token successfully', async () => {
      const user = await service.validateToken('ghp_validToken1234567890abcdef');
      expect(user).toBeDefined();
      expect(user.login).toBe('octocat');
      expect(user.id).toBe(583231);
    });

    it('throws GITHUB_AUTH_FAILED error for empty or invalid tokens', async () => {
      await expect(service.validateToken('invalid_token')).rejects.toThrow('GitHub authentication failed');
    });

    it('throws GITHUB_RATE_LIMITED when rate limit is exceeded', async () => {
      mockProvider.shouldFailRateLimit = true;
      await expect(service.validateToken('ghp_validToken')).rejects.toThrow('rate limit exceeded');
    });
  });

  describe('Repo Metadata & Permissions', () => {
    it('fetches repo metadata and permissions correctly', async () => {
      const meta = await service.getRepoMetadata('octocat', 'agentops-repo', 'ghp_validToken');
      expect(meta.fullName).toBe('octocat/agentops-repo');
      expect(meta.defaultBranch).toBe('main');
      expect(meta.permissions.admin).toBe(true);
      expect(meta.permissions.push).toBe(true);
      expect(meta.permissions.pull).toBe(true);
    });

    it('throws GITHUB_REPO_NOT_FOUND when repo does not exist', async () => {
      mockProvider.shouldFailRepoNotFound = true;
      await expect(service.getRepoMetadata('octocat', 'unknown-repo', 'ghp_validToken'))
        .rejects.toThrow('not found');
    });

    it('checks permissions explicitly', async () => {
      const permissions = await service.checkPermissions('octocat', 'agentops-repo', 'ghp_validToken');
      expect(permissions.pull).toBe(true);
      expect(permissions.push).toBe(true);
    });
  });

  describe('Safe Read-Only Connection Test', () => {
    it('executes safe connection test and returns user, metadata, and permissions', async () => {
      const result = await service.testConnection({
        owner: 'octocat',
        repo: 'agentops-repo',
        token: 'ghp_validToken1234567890abcdef',
        defaultBranch: 'main',
      });

      expect(result.success).toBe(true);
      expect(result.authenticatedUser).toBe('octocat');
      expect(result.repo).toBeDefined();
      expect(result.repo?.fullName).toBe('octocat/agentops-repo');
      expect(result.permissions?.push).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns success: false with sanitized error message on failed connection test', async () => {
      mockProvider.shouldFailAuth = true;
      const result = await service.testConnection({
        owner: 'octocat',
        repo: 'agentops-repo',
        token: 'ghp_invalidToken12345',
      });

      expect(result.success).toBe(false);
      expect(result.authenticatedUser).toBeNull();
      expect(result.repo).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('authentication failed');
    });
  });

  describe('Repo File Reading & Code Search', () => {
    it('reads a repository file successfully', async () => {
      const file = await service.readFile('octocat', 'agentops-repo', 'package.json', undefined, 'ghp_validToken');
      expect(file).toBeDefined();
      expect(file.name).toBe('package.json');
      expect(file.content).toContain('agentops');
    });

    it('throws 404 GITHUB_REPO_NOT_FOUND when file does not exist', async () => {
      await expect(service.readFile('octocat', 'agentops-repo', 'nonexistent.txt', undefined, 'ghp_validToken'))
        .rejects.toThrow('not found');
    });

    it('searches repository code matching a query string', async () => {
      const search = await service.searchCode('octocat', 'agentops-repo', 'AgentOps', 'ghp_validToken');
      expect(search.totalCount).toBeGreaterThan(0);
      expect(search.items[0].path).toBeDefined();
    });
  });

  describe('Branch Listing & Branch Permission Checks', () => {
    it('lists all repository branches', async () => {
      const branches = await service.listBranches('octocat', 'agentops-repo', 'ghp_validToken');
      expect(branches.length).toBeGreaterThan(0);
      expect(branches.some(b => b.name === 'main')).toBe(true);
    });

    it('validates branch names and rejects direct changes to main/master', () => {
      const mainVal = service.validateBranchName('main', 'main');
      expect(mainVal.valid).toBe(false);
      expect(mainVal.reason).toContain('strictly forbidden');

      const masterVal = service.validateBranchName('master', 'main');
      expect(masterVal.valid).toBe(false);

      const validTaskBranch = service.validateBranchName('agentops/task-101', 'main');
      expect(validTaskBranch.valid).toBe(true);
    });

    it('rejects branch names with invalid characters or whitespace', () => {
      expect(service.validateBranchName('invalid branch').valid).toBe(false);
      expect(service.validateBranchName('invalid~branch').valid).toBe(false);
      expect(service.validateBranchName('invalid..branch').valid).toBe(false);
      expect(service.validateBranchName('/slash/').valid).toBe(false);
    });

    it('checks branch permissions correctly', async () => {
      const permResult = await service.checkBranchPermissions('octocat', 'agentops-repo', 'agentops/task-102', 'ghp_validToken');
      expect(permResult.canCreateBranch).toBe(true);
      expect(permResult.canPushDirectly).toBe(false);

      const mainPermResult = await service.checkBranchPermissions('octocat', 'agentops-repo', 'main', 'ghp_validToken');
      expect(mainPermResult.canCreateBranch).toBe(false);
      expect(mainPermResult.reason).toContain('forbidden');
    });
  });

  describe('Task Branch Creation', () => {
    it('creates a new task branch from default main branch', async () => {
      const newBranch = await service.createTaskBranch('octocat', 'agentops-repo', 'agentops/task-103', 'main', 'ghp_validToken');
      expect(newBranch).toBeDefined();
      expect(newBranch.name).toBe('agentops/task-103');
      expect(newBranch.commitSha).toBeDefined();

      const branches = await service.listBranches('octocat', 'agentops-repo', 'ghp_validToken');
      expect(branches.some(b => b.name === 'agentops/task-103')).toBe(true);
    });

    it('throws GITHUB_PERMISSION_DENIED if attempt is made to create branch named main', async () => {
      await expect(service.createTaskBranch('octocat', 'agentops-repo', 'main', undefined, 'ghp_validToken'))
        .rejects.toThrow('strictly forbidden');
    });

    it('throws error if target task branch already exists', async () => {
      await service.createTaskBranch('octocat', 'agentops-repo', 'agentops/task-104', 'main', 'ghp_validToken');
      await expect(service.createTaskBranch('octocat', 'agentops-repo', 'agentops/task-104', 'main', 'ghp_validToken'))
        .rejects.toThrow('already exists');
    });
  });

  describe('Token Masking & Credential Security', () => {
    it('masks tokens safely without leaking full secret strings', () => {
      const rawToken = 'ghp_1234567890abcdefghijklmnopqrstuv';
      const masked = GitHubService.maskToken(rawToken);

      expect(masked).toBe('ghp_****stuv');
      expect(masked).not.toContain('1234567890abcdef');
    });

    it('converts config to masked config safely', () => {
      const config = {
        owner: 'octocat',
        repo: 'agentops',
        token: 'ghp_SECRET_TOKEN_999999',
        defaultBranch: 'main',
      };

      const maskedConfig = service.toMaskedConfig(config);
      expect(maskedConfig.maskedToken).toBe('ghp_****9999');
      expect(JSON.stringify(maskedConfig)).not.toContain('SECRET_TOKEN');
    });

    it('redacts GitHub PAT and OAuth tokens from string logs', () => {
      const logMessage = 'Failed connecting with token ghp_1234567890abcdef1234567890abcdef123456';
      const redacted = redactString(logMessage);

      expect(redacted).not.toContain('ghp_1234567890');
      expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]');
    });
  });

  describe('Applying & Committing Code Changes', () => {
    it('applies file changes on a task branch successfully and redacts secrets', async () => {
      await service.createTaskBranch('octocat', 'agentops-repo', 'agentops/task-201', 'main', 'ghp_validToken');

      const commitResult = await service.applyFileChanges({
        owner: 'octocat',
        repo: 'agentops-repo',
        branch: 'agentops/task-201',
        commitMessage: 'fix(auth): resolve secret leak with ghp_1234567890abcdef1234567890abcdef123456',
        changes: [
          {
            path: 'src/auth.ts',
            content: 'export const token = "ghp_1234567890abcdef1234567890abcdef123456";',
            operation: 'create',
          },
        ],
        token: 'ghp_validToken',
      });

      expect(commitResult).toBeDefined();
      expect(commitResult.branch).toBe('agentops/task-201');
      expect(commitResult.filesCommitted).toContain('src/auth.ts');
      expect(commitResult.commitSha).toBeDefined();

      // Verify file content in mock state was redacted
      const updatedFile = await service.readFile('octocat', 'agentops-repo', 'src/auth.ts', 'agentops/task-201', 'ghp_validToken');
      expect(updatedFile.content).toContain('[REDACTED_GITHUB_TOKEN]');
      expect(updatedFile.content).not.toContain('ghp_1234567890abcdef');
    });

    it('rejects file changes targeting main or default branch directly', async () => {
      await expect(
        service.applyFileChanges({
          owner: 'octocat',
          repo: 'agentops-repo',
          branch: 'main',
          commitMessage: 'fix: direct commit to main',
          changes: [{ path: 'README.md', content: 'Updated' }],
          token: 'ghp_validToken',
        })
      ).rejects.toThrow('strictly forbidden');
    });

    it('throws error if changes list is empty', async () => {
      await service.createTaskBranch('octocat', 'agentops-repo', 'agentops/task-202', 'main', 'ghp_validToken');
      await expect(
        service.applyFileChanges({
          owner: 'octocat',
          repo: 'agentops-repo',
          branch: 'agentops/task-202',
          commitMessage: 'empty change set',
          changes: [],
          token: 'ghp_validToken',
        })
      ).rejects.toThrow('At least one file change must be provided');
    });
  });

  describe('Pull Request Creation & Summary Attachment', () => {
    it('creates a pull request with finding summary, root cause analysis, and test results', async () => {
      await service.createTaskBranch('octocat', 'agentops-repo', 'agentops/task-301', 'main', 'ghp_validToken');

      const pr = await service.createPullRequest({
        owner: 'octocat',
        repo: 'agentops-repo',
        head: 'agentops/task-301',
        title: 'fix(auth): resolve session expiration crash with ghp_1234567890abcdef1234567890abcdef123456',
        body: 'Custom PR description',
        findingSummary: {
          title: 'Session Token Crash',
          severity: 'critical',
          description: 'Uncaught token null pointer exception on refresh',
          expectedResult: 'Graceful redirect to login',
          actualResult: 'HTTP 500 white screen crash',
        },
        rootCauseAnalysis: {
          likelyCause: 'Missing null check in token refresh middleware',
          suspectedFileOrComponent: 'src/middleware/auth.ts',
          recommendedAction: 'Add optional chaining guard and session refresh timeout',
          facts: ['Server returned 500 Internal Server Error'],
          inference: ['Session token cookie expired before request payload parse'],
        },
        testRunnerResult: {
          passed: true,
          durationMs: 1450,
          testSuitesRun: [
            { name: 'unit-tests', passed: true },
            { name: 'integration-tests', passed: true },
          ],
        },
        token: 'ghp_validToken',
      });

      expect(pr).toBeDefined();
      expect(pr.number).toBeGreaterThan(0);
      expect(pr.headBranch).toBe('agentops/task-301');
      expect(pr.baseBranch).toBe('main');

      // Check title and body for redaction and formatted sections
      expect(pr.title).not.toContain('ghp_1234567890');
      expect(pr.body).toContain('Finding Details');
      expect(pr.body).toContain('CRITICAL');
      expect(pr.body).toContain('AI Root-Cause Analysis');
      expect(pr.body).toContain('Test Execution Summary');
      expect(pr.body).toContain('✅ PASSED');
    });

    it('blocks PR creation if test runner checks indicate failure', async () => {
      await service.createTaskBranch('octocat', 'agentops-repo', 'agentops/task-302', 'main', 'ghp_validToken');

      await expect(
        service.createPullRequest({
          owner: 'octocat',
          repo: 'agentops-repo',
          head: 'agentops/task-302',
          title: 'fix: broken code fix proposal',
          testRunnerResult: {
            passed: false,
            failedCommands: ['npx vitest run tests/unit/auth.test.ts'],
            testSuitesRun: [{ name: 'unit-tests', passed: false }],
          },
          token: 'ghp_validToken',
        })
      ).rejects.toThrow('Pull request creation blocked: Required test suites failed');
    });

    it('rejects PR creation when head branch is main', async () => {
      await expect(
        service.createPullRequest({
          owner: 'octocat',
          repo: 'agentops-repo',
          head: 'main',
          title: 'invalid pr from main to main',
          token: 'ghp_validToken',
        })
      ).rejects.toThrow('Cannot create pull request from branch \'main\'');
    });
  });

  describe('PR CI & Check Status Inspection', () => {
    it('inspects PR check status and aggregates overall status', async () => {
      const status = await service.getPRCheckStatus('octocat', 'agentops-repo', 1, 'ghp_validToken');

      expect(status).toBeDefined();
      expect(status.prNumber).toBe(1);
      expect(status.overallStatus).toBe('passed');
      expect(status.checkRuns.length).toBeGreaterThan(0);
      expect(status.combinedStatus).toBeDefined();
    });
  });
});

