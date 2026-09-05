import type { FastifyPluginAsync } from 'fastify';
import { GitHubService } from './github.service.js';
import { FetchGitHubProvider } from '../../infrastructure/github/fetch-github-provider.js';
import type { GitHubProvider } from './github.provider.js';
import {
  validateTokenSchema,
  repoMetadataSchema,
  testConnectionSchema,
  readFileSchema,
  searchCodeSchema,
  listBranchesSchema,
  createTaskBranchSchema,
  commitChangesSchema,
  createPullRequestSchema,
  prStatusSchema,
} from './github.schema.js';
import { AppError } from '../../core/errors.js';
import { redactObject } from '../../infrastructure/redact/redactSensitive.js';

export interface GitHubRoutesOptions {
  provider?: GitHubProvider;
}

export const githubRoutes: FastifyPluginAsync<GitHubRoutesOptions> = async (fastify, opts) => {
  const provider = opts.provider || new FetchGitHubProvider();
  const service = new GitHubService(provider);

  // POST /api/v1/github/validate-token
  fastify.post('/validate-token', async (request, reply) => {
    const parseResult = validateTokenSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid token validation request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const { token, baseUrl } = parseResult.data;
    const user = await service.validateToken(token, baseUrl);

    return reply.status(200).send({
      status: 'success',
      data: {
        authenticatedUser: user,
      },
    });
  });

  // POST /api/v1/github/repo-metadata
  fastify.post('/repo-metadata', async (request, reply) => {
    const parseResult = repoMetadataSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid repo metadata request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const { owner, repo, token, baseUrl } = parseResult.data;
    const metadata = await service.getRepoMetadata(owner, repo, token, baseUrl);

    return reply.status(200).send({
      status: 'success',
      data: {
        repo: metadata,
      },
    });
  });

  // POST /api/v1/github/test-connection
  fastify.post('/test-connection', async (request, reply) => {
    const parseResult = testConnectionSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid connection test request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const config = parseResult.data;
    const result = await service.testConnection(config);
    const maskedConfig = service.toMaskedConfig(config);

    const safeResponse = redactObject({
      status: 'success',
      data: {
        connection: result,
        config: maskedConfig,
      },
    });

    return reply.status(200).send(safeResponse);
  });

  // POST /api/v1/github/read-file
  fastify.post('/read-file', async (request, reply) => {
    const parseResult = readFileSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid read file request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const { owner, repo, path, ref, token, baseUrl } = parseResult.data;
    const file = await service.readFile(owner, repo, path, ref, token, baseUrl);

    return reply.status(200).send({
      status: 'success',
      data: {
        file,
      },
    });
  });

  // POST /api/v1/github/search-code
  fastify.post('/search-code', async (request, reply) => {
    const parseResult = searchCodeSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid code search request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const { owner, repo, query, token, baseUrl } = parseResult.data;
    const searchResult = await service.searchCode(owner, repo, query, token, baseUrl);

    return reply.status(200).send({
      status: 'success',
      data: {
        search: searchResult,
      },
    });
  });

  // POST /api/v1/github/branches
  fastify.post('/branches', async (request, reply) => {
    const parseResult = listBranchesSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid branch listing request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const { owner, repo, token, baseUrl } = parseResult.data;
    const branches = await service.listBranches(owner, repo, token, baseUrl);

    return reply.status(200).send({
      status: 'success',
      data: {
        branches,
      },
    });
  });

  // POST /api/v1/github/create-task-branch
  fastify.post('/create-task-branch', async (request, reply) => {
    const parseResult = createTaskBranchSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid task branch creation request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const { owner, repo, branchName, fromBranch, token, baseUrl } = parseResult.data;
    const branch = await service.createTaskBranch(owner, repo, branchName, fromBranch, token, baseUrl);

    return reply.status(200).send({
      status: 'success',
      data: {
        branch,
      },
    });
  });

  // POST /api/v1/github/commit
  fastify.post('/commit', async (request, reply) => {
    const parseResult = commitChangesSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid commit request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const commitResult = await service.applyFileChanges(parseResult.data);

    return reply.status(200).send({
      status: 'success',
      data: {
        commit: commitResult,
      },
    });
  });

  // POST /api/v1/github/pulls
  fastify.post('/pulls', async (request, reply) => {
    const parseResult = createPullRequestSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid pull request creation request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const pullRequest = await service.createPullRequest(parseResult.data);

    return reply.status(201).send({
      status: 'success',
      data: {
        pullRequest,
      },
    });
  });

  // POST /api/v1/github/pr-status
  fastify.post('/pr-status', async (request, reply) => {
    const parseResult = prStatusSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid PR status request';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const { owner, repo, pullNumber, token, baseUrl } = parseResult.data;
    const statusResult = await service.getPRCheckStatus(owner, repo, pullNumber, token, baseUrl);

    return reply.status(200).send({
      status: 'success',
      data: {
        status: statusResult,
      },
    });
  });
};

