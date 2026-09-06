import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { runnerRoutes } from '../../src/modules/runner/runner.routes.js';
import type { CommandExecutorFn } from '../../src/modules/runner/runner.service.js';
import { AppError } from '../../src/core/errors.js';
import { redactString } from '../../src/infrastructure/redact/redactSensitive.js';

describe('Fix Test Runner Integration Routes (API)', () => {
  let app: FastifyInstance;
  let mockExecutor: CommandExecutorFn;

  beforeEach(async () => {
    mockExecutor = async (command: string) => {
      return {
        stdout: `Passed command: ${command}`,
        stderr: '',
        exitCode: 0,
      };
    };

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

    await app.register(runnerRoutes, {
      prefix: '/api/v1/fix-runner',
      customExecutor: mockExecutor,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/fix-runner/run', () => {
    it('executes test runner on a task branch and returns structured testRun results', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/fix-runner/run',
        payload: {
          branchName: 'agentops/task-501',
          suiteTypes: ['unit', 'integration'],
          changedFiles: ['src/modules/github/github.service.ts'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('success');
      expect(body.data.testRun.passed).toBe(true);
      expect(body.data.testRun.affectedBranch).toBe('agentops/task-501');
      expect(body.data.testRun.testSuitesRun.length).toBeGreaterThan(0);
    });

    it('returns 403 FORBIDDEN when target branch is main', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/fix-runner/run',
        payload: {
          branchName: 'main',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('strictly blocked');
    });

    it('returns 400 VALIDATION_ERROR when branchName is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/fix-runner/run',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
