import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { githubRoutes } from '../../src/modules/github/github.routes.js';
import { MockGitHubProvider } from '../../src/infrastructure/github/mock-github-provider.js';
import { AppError } from '../../src/core/errors.js';
import { redactString } from '../../src/infrastructure/redact/redactSensitive.js';

describe('GitHub Integration Routes (API)', () => {
  let app: FastifyInstance;
  let mockProvider: MockGitHubProvider;

  beforeEach(async () => {
    mockProvider = new MockGitHubProvider();

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

    await app.register(githubRoutes, {
      prefix: '/api/v1/github',
      provider: mockProvider,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/github/validate-token', () => {
    it('validates token and returns authenticated user details', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/validate-token',
        payload: {
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.authenticatedUser.login).toBe('octocat');
    });

    it('returns 400 validation error when token is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/validate-token',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 GITHUB_AUTH_FAILED for invalid token', async () => {
      mockProvider.shouldFailAuth = true;
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/validate-token',
        payload: {
          token: 'ghp_invalidToken',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('GITHUB_AUTH_FAILED');
    });
  });

  describe('POST /api/v1/github/repo-metadata', () => {
    it('fetches repository metadata and permissions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/repo-metadata',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.repo.fullName).toBe('octocat/agentops-repo');
      expect(body.data.repo.permissions.push).toBe(true);
    });

    it('returns 404 GITHUB_REPO_NOT_FOUND when repository does not exist', async () => {
      mockProvider.shouldFailRepoNotFound = true;
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/repo-metadata',
        payload: {
          owner: 'octocat',
          repo: 'missing-repo',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('GITHUB_REPO_NOT_FOUND');
    });
  });

  describe('POST /api/v1/github/test-connection', () => {
    it('runs safe read-only connection test and returns masked config', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/test-connection',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          token: 'ghp_superSecretToken123456789',
          defaultBranch: 'main',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.connection.success).toBe(true);
      expect(body.data.connection.authenticatedUser).toBe('octocat');
      expect(body.data.config.maskedToken).toBe('ghp_****6789');
      expect(response.payload).not.toContain('superSecretToken');
    });
  });

  describe('POST /api/v1/github/read-file', () => {
    it('reads specified file content from repo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/read-file',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          path: 'package.json',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.file.path).toBe('package.json');
      expect(body.data.file.content).toContain('agentops');
    });
  });

  describe('POST /api/v1/github/search-code', () => {
    it('searches code in repository matching query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/search-code',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          query: 'agentops',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.search.items.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/github/branches', () => {
    it('returns list of branches in repository', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/branches',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.branches.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/github/create-task-branch', () => {
    it('creates a new task branch from default main branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/create-task-branch',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          branchName: 'agentops/feature-qa-tests',
          fromBranch: 'main',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.branch.name).toBe('agentops/feature-qa-tests');
    });

    it('rejects attempt to create or target branch named main', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/create-task-branch',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          branchName: 'main',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('GITHUB_PERMISSION_DENIED');
      expect(body.error.message).toContain('forbidden');
    });
  });

  describe('POST /api/v1/github/commit', () => {
    it('applies file changes on a task branch and returns commit SHA', async () => {
      // First create a task branch
      await app.inject({
        method: 'POST',
        url: '/api/v1/github/create-task-branch',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          branchName: 'agentops/fix-issue-401',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/commit',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          branch: 'agentops/fix-issue-401',
          commitMessage: 'fix(engine): resolve crash on invalid input',
          changes: [
            {
              path: 'src/engine.ts',
              content: 'export function fix() { return true; }',
              operation: 'create',
            },
          ],
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.commit.branch).toBe('agentops/fix-issue-401');
      expect(body.data.commit.commitSha).toBeDefined();
      expect(body.data.commit.filesCommitted).toContain('src/engine.ts');
    });

    it('returns 403 when committing directly to main branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/commit',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          branch: 'main',
          commitMessage: 'fix directly on main',
          changes: [{ path: 'src/index.ts', content: 'modified' }],
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('GITHUB_PERMISSION_DENIED');
      expect(body.error.message).toContain('strictly forbidden');
    });
  });

  describe('POST /api/v1/github/pulls', () => {
    it('creates a pull request with finding, root-cause, and test summaries attached', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/github/create-task-branch',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          branchName: 'agentops/task-501',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/pulls',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          head: 'agentops/task-501',
          title: 'fix(auth): resolve session token refresh exception',
          findingSummary: {
            title: 'Session Refresh Exception',
            severity: 'high',
            description: 'Uncaught TypeError in refresh token handler',
          },
          rootCauseAnalysis: {
            likelyCause: 'Unchecked null refresh token string',
            recommendedAction: 'Add null guard before token validation',
          },
          testRunnerResult: {
            passed: true,
            durationMs: 1200,
          },
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.pullRequest.number).toBeGreaterThan(0);
      expect(body.data.pullRequest.headBranch).toBe('agentops/task-501');
      expect(body.data.pullRequest.body).toContain('Session Refresh Exception');
      expect(body.data.pullRequest.body).toContain('HIGH');
    });

    it('blocks PR creation with 400 when required tests fail', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/github/create-task-branch',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          branchName: 'agentops/task-502',
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/pulls',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          head: 'agentops/task-502',
          title: 'fix: broken code fix proposal',
          testRunnerResult: {
            passed: false,
            failedCommands: ['npx vitest run tests/unit/auth.test.ts'],
          },
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('GITHUB_API_ERROR');
      expect(body.error.message).toContain('Pull request creation blocked');
    });
  });

  describe('POST /api/v1/github/pr-status', () => {
    it('returns PR check status and overall status summary', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/github/pr-status',
        payload: {
          owner: 'octocat',
          repo: 'agentops-repo',
          pullNumber: 1,
          token: 'ghp_validToken1234567890abcdef',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.status.prNumber).toBe(1);
      expect(body.data.status.overallStatus).toBe('passed');
      expect(body.data.status.checkRuns.length).toBeGreaterThan(0);
    });
  });
});

