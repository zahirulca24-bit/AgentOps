import type { FastifyPluginAsync } from 'fastify';
import { selfFixLoopInputSchema } from './self-fix.schema.js';
import { SelfFixLoopService } from './self-fix.service.js';
import { RootCauseAnalysisService } from '../analysis/analysis.service.js';
import { CodeFixService } from '../fix/fix.service.js';
import { FixTestRunnerService } from '../runner/runner.service.js';
import { FetchGitHubProvider } from '../../infrastructure/github/fetch-github-provider.js';
import type { GitHubProvider } from '../github/github.provider.js';
import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
import { AppError } from '../../core/errors.js';

export interface SelfFixRoutesOptions {
  db?: Database;
  aiProvider?: AIProvider;
  githubProvider?: GitHubProvider;
  service?: SelfFixLoopService;
}

export const selfFixRoutes: FastifyPluginAsync<SelfFixRoutesOptions> = async (fastify, opts) => {
  let service = opts.service;

  if (!service) {
    if (!opts.db || !opts.aiProvider) {
      throw new Error('SelfFixRoutes requires db and aiProvider options when service is not supplied');
    }

    const githubProvider = opts.githubProvider || new FetchGitHubProvider();
    const rcaService = new RootCauseAnalysisService(opts.db, opts.aiProvider);
    const codeFixService = new CodeFixService(opts.db, opts.aiProvider, githubProvider);
    const testRunnerService = new FixTestRunnerService();

    service = new SelfFixLoopService(
      opts.db,
      rcaService,
      codeFixService,
      testRunnerService,
      githubProvider
    );
  }

  // POST /api/v1/issues/:id/self-fix
  fastify.post('/:id/self-fix', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!id) {
      throw new AppError('VALIDATION_ERROR', 'Issue ID is required', 400);
    }

    const parseResult = selfFixLoopInputSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid self-fix loop input';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const result = await service.runSelfFixLoop({
      issueId: id,
      ...parseResult.data,
    });

    const statusCode = result.success ? 200 : result.status === 'escalated' ? 200 : 400;

    return reply.status(statusCode).send({
      status: 'success',
      data: {
        loopResult: result,
      },
    });
  });
};
