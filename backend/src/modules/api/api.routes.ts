import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
import type { BrowserManager } from '../../infrastructure/browser/browser.manager.js';
import type { EnvConfig } from '../../config/env.js';
import { projects, tasks, runs, testCases, testResults, issues, browserSessions, evidence } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { PlannerService } from '../planner/planner.service.js';
import { TestGeneratorService } from '../generator/generator.service.js';
import { ExecutionService } from '../execution/execution.service.js';

const createProjectSchema = z.object({
  name: z.string().min(1),
  targetUrl: z.string().url().optional(),
});

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  command: z.string().min(1),
  targetUrl: z.string().url().optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const taskIdParamSchema = z.object({
  taskId: z.string().uuid(),
});

export async function apiRoutes(
  fastify: FastifyInstance,
  options: { db: Database; aiProvider: AIProvider; browserManager: BrowserManager; config: EnvConfig }
) {
  const { db, aiProvider, browserManager, config } = options;
  const plannerService = new PlannerService(db, aiProvider);
  const generatorService = new TestGeneratorService(db, aiProvider, config);
  const executionService = new ExecutionService(db, browserManager, config);

  // POST /api/v1/projects
  fastify.post('/api/v1/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid project payload', 400);
    }

    const [project] = await db.insert(projects).values({
      name: parseResult.data.name,
      targetUrl: parseResult.data.targetUrl,
    }).returning();

    return reply.status(201).send({ data: project });
  });

  // GET /api/v1/projects
  fastify.get('/api/v1/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    const list = await db.select().from(projects).orderBy(desc(projects.createdAt));
    return reply.send({ data: list });
  });

  // POST /api/v1/tasks
  fastify.post('/api/v1/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createTaskSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid task payload', 400);
    }

    const [task] = await db.insert(tasks).values({
      projectId: parseResult.data.projectId,
      command: parseResult.data.command,
      targetUrl: parseResult.data.targetUrl,
      status: 'pending',
    }).returning();

    return reply.status(201).send({ data: task });
  });

  // POST /api/v1/tasks/:taskId/execute - ASYNCHRONOUS RUN EXECUTION
  fastify.post('/api/v1/tasks/:taskId/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = taskIdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid task ID format', 400);
    }

    const { taskId } = parseResult.data;

    // Load Task
    const taskRecord = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!taskRecord) {
      throw new AppError('NOT_FOUND', `Task ${taskId} not found`, 404);
    }

    // 1. Generate Plan if needed
    const plan = await plannerService.generatePlan(taskId);

    // 2. Find Created Run
    const latestRun = await db.query.runs.findFirst({
      where: eq(runs.taskId, taskId),
      orderBy: desc(runs.createdAt),
    });

    if (!latestRun) {
      throw new AppError('INTERNAL_ERROR', 'Failed to initialize run', 500);
    }

    // 3. Generate Test Cases
    const testCasesList = await generatorService.generateTests({
      runId: latestRun.id,
      objective: taskRecord.command,
      planSteps: plan.steps,
      explorationData: { flowCandidates: [], observations: {} },
    });

    if (testCasesList.length > 0) {
      await db.insert(testCases).values(
        testCasesList.map((tc: any) => ({
          runId: latestRun.id,
          name: tc.name,
          category: tc.category,
          priority: tc.priority,
          preconditions: tc.preconditions,
          steps: tc.steps,
          assertions: tc.assertions,
        }))
      );
    }

    // 4. Update status to pending before async trigger
    await db.update(runs).set({ status: 'pending' }).where(eq(runs.id, latestRun.id));

    // 5. Fire-and-forget asynchronous execution!
    void executionService.executeRun(latestRun.id).catch(err => {
      request.log.error({ err, runId: latestRun.id }, 'Asynchronous run execution failed');
    });

    // Return 202 Accepted immediately to frontend
    return reply.status(202).send({
      data: {
        run: {
          ...latestRun,
          status: 'running',
        },
        testsGenerated: testCasesList.length,
        results: [],
      }
    });
  });

  // GET /api/v1/runs
  fastify.get('/api/v1/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    const runList = await db.query.runs.findMany({
      orderBy: desc(runs.createdAt),
      with: {
        testResults: true,
        issues: true,
        evidence: true,
        browserSessions: true,
      }
    });

    return reply.send({ data: runList });
  });

  // GET /api/v1/runs/:id
  fastify.get('/api/v1/runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid run ID format', 400);
    }

    const runRecord = await db.query.runs.findFirst({
      where: eq(runs.id, parseResult.data.id),
      with: {
        testResults: true,
        issues: true,
        evidence: true,
        browserSessions: true,
      }
    });

    if (!runRecord) {
      throw new AppError('NOT_FOUND', `Run ${parseResult.data.id} not found`, 404);
    }

    return reply.send({ data: runRecord });
  });

  // POST /api/v1/runs/:id/cancel
  fastify.post('/api/v1/runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid run ID format', 400);
    }

    await executionService.cancelRun(parseResult.data.id);

    return reply.send({
      data: {
        runId: parseResult.data.id,
        status: 'stopped',
      }
    });
  });

  // GET /api/v1/issues
  fastify.get('/api/v1/issues', async (request: FastifyRequest, reply: FastifyReply) => {
    const issueList = await db.query.issues.findMany({
      orderBy: desc(issues.createdAt),
    });
    return reply.send({ data: issueList });
  });

  // GET /api/v1/issues/:id
  fastify.get('/api/v1/issues/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid issue ID format', 400);
    }

    const issueRecord = await db.query.issues.findFirst({
      where: eq(issues.id, parseResult.data.id),
    });

    if (!issueRecord) {
      throw new AppError('NOT_FOUND', `Issue ${parseResult.data.id} not found`, 404);
    }

    return reply.send({ data: issueRecord });
  });

  // GET /api/v1/browser-sessions
  fastify.get('/api/v1/browser-sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionList = await db.query.browserSessions.findMany({
      orderBy: desc(browserSessions.createdAt),
    });
    return reply.send({ data: sessionList });
  });

  // GET /api/v1/browser-sessions/:id
  fastify.get('/api/v1/browser-sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid browser session ID format', 400);
    }

    const sessionRecord = await db.query.browserSessions.findFirst({
      where: eq(browserSessions.id, parseResult.data.id),
    });

    if (!sessionRecord) {
      throw new AppError('NOT_FOUND', `Browser session ${parseResult.data.id} not found`, 404);
    }

    return reply.send({ data: sessionRecord });
  });
}
