import type { FastifyPluginAsync } from 'fastify';
import { FixTestRunnerService, type CommandExecutorFn } from './runner.service.js';
import { testRunnerInputSchema } from './runner.schema.js';
import { AppError } from '../../core/errors.js';
import { redactObject } from '../../infrastructure/redact/redactSensitive.js';

export interface RunnerRoutesOptions {
  customExecutor?: CommandExecutorFn;
}

export const runnerRoutes: FastifyPluginAsync<RunnerRoutesOptions> = async (fastify, opts) => {
  const service = new FixTestRunnerService(process.cwd(), opts.customExecutor);

  // POST /api/v1/fix-runner/run
  fastify.post('/run', async (request, reply) => {
    const parseResult = testRunnerInputSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid test runner request payload';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const testRunResult = await service.runTests(parseResult.data);
    const safeResult = redactObject(testRunResult);

    return reply.status(200).send({
      status: 'success',
      data: {
        testRun: safeResult,
      },
    });
  });
};
