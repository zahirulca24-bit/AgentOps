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
import { SeverityClassifierService } from '../severity/severity.service.js';
import { RootCauseAnalysisService } from '../analysis/analysis.service.js';
import { CodeFixService } from '../fix/fix.service.js';
import { codeFixInputSchema } from '../fix/fix.schema.js';

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

const createIssueSchema = z.object({
  runId: z.string().uuid(),
  testResultId: z.string().uuid().optional(),
  browserSessionId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  severityReason: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['open', 'investigating', 'fixed', 'closed']).default('open'),
  reproductionSteps: z.array(z.string()).or(z.any()).optional(),
  expectedResult: z.string().optional(),
  actualResult: z.string().optional(),
  screenshotEvidence: z.array(z.string()).or(z.any()).optional(),
  consoleEvidence: z.array(z.string()).or(z.any()).optional(),
  networkEvidence: z.array(z.string()).or(z.any()).optional(),
  affectedUrl: z.string().optional(),
  userFlowImpact: z.enum(['blocking', 'degraded', 'minor', 'none']).optional(),
  securityImpact: z.enum(['high_risk', 'medium_risk', 'low_risk', 'none']).optional(),
  dataLossRisk: z.boolean().optional(),
  paymentAuthImpact: z.enum(['payment_failure', 'auth_failure', 'checkout_blocked', 'login_blocked', 'none']).optional(),
  reproducibility: z.enum(['always', 'frequent', 'intermittent', 'rare']).optional(),
  scopeOfUsers: z.enum(['all_users', 'many_users', 'some_users', 'isolated']).optional(),
});

const updateIssueSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  severityReason: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['open', 'investigating', 'fixed', 'closed']).optional(),
  reproductionSteps: z.array(z.string()).or(z.any()).optional(),
  expectedResult: z.string().optional(),
  actualResult: z.string().optional(),
  screenshotEvidence: z.array(z.string()).or(z.any()).optional(),
  consoleEvidence: z.array(z.string()).or(z.any()).optional(),
  networkEvidence: z.array(z.string()).or(z.any()).optional(),
  affectedUrl: z.string().optional(),
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

  const severityClassifier = new SeverityClassifierService();
  const analysisService = new RootCauseAnalysisService(db, aiProvider);

  // POST /api/v1/issues - CREATE STRUCTURED BUG / FINDING
  fastify.post('/api/v1/issues', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createIssueSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid issue payload', 400);
    }

    const payload = parseResult.data;

    // Run deterministic severity classifier if severity or severityReason not provided
    let computedSeverity = payload.severity;
    let computedSeverityReason = payload.severityReason;

    if (!computedSeverity || !computedSeverityReason) {
      const classification = severityClassifier.classify({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        affectedUrl: payload.affectedUrl,
        actualResult: payload.actualResult,
        expectedResult: payload.expectedResult,
        userFlowImpact: payload.userFlowImpact,
        securityImpact: payload.securityImpact,
        dataLossRisk: payload.dataLossRisk,
        paymentAuthImpact: payload.paymentAuthImpact,
        reproducibility: payload.reproducibility,
        scopeOfUsers: payload.scopeOfUsers,
      });

      computedSeverity = computedSeverity || classification.severity;
      computedSeverityReason = computedSeverityReason || classification.reason;
    }

    const [createdIssue] = await db.insert(issues).values({
      runId: payload.runId,
      testResultId: payload.testResultId,
      browserSessionId: payload.browserSessionId,
      title: payload.title,
      description: payload.description,
      severity: computedSeverity,
      severityReason: computedSeverityReason,
      category: payload.category || 'functional',
      status: payload.status,
      reproductionSteps: payload.reproductionSteps,
      expectedResult: payload.expectedResult,
      actualResult: payload.actualResult,
      screenshotEvidence: payload.screenshotEvidence,
      consoleEvidence: payload.consoleEvidence,
      networkEvidence: payload.networkEvidence,
      affectedUrl: payload.affectedUrl,
    }).returning();

    return reply.status(201).send({ data: createdIssue });
  });

  // GET /api/v1/issues - LIST BUGS / FINDINGS
  fastify.get('/api/v1/issues', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any || {};
    const whereConditions: any = {};
    if (query.runId) whereConditions.runId = query.runId;
    if (query.severity) whereConditions.severity = query.severity;
    if (query.status) whereConditions.status = query.status;

    const issueList = await db.query.issues.findMany({
      where: Object.keys(whereConditions).length > 0 ? (table: any) => {
        const conditions: any[] = [];
        if (query.runId) conditions.push(eq(table.runId, query.runId));
        if (query.severity) conditions.push(eq(table.severity, query.severity));
        if (query.status) conditions.push(eq(table.status, query.status));
        return conditions.length === 1 ? conditions[0] : undefined;
      } : undefined,
      orderBy: desc(issues.createdAt),
      with: {
        evidence: true,
        testResult: true,
        browserSession: true,
      }
    });

    // Filter in-memory if multiple parameters present
    let filteredList = issueList;
    if (query.runId) filteredList = filteredList.filter((i: any) => i.runId === query.runId);
    if (query.severity) filteredList = filteredList.filter((i: any) => i.severity === query.severity);
    if (query.status) filteredList = filteredList.filter((i: any) => i.status === query.status);

    return reply.send({ data: filteredList });
  });

  // GET /api/v1/issues/:id - GET BUG / FINDING DETAILS
  fastify.get('/api/v1/issues/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid issue ID format', 400);
    }

    const issueRecord = await db.query.issues.findFirst({
      where: eq(issues.id, parseResult.data.id),
      with: {
        evidence: true,
        testResult: true,
        browserSession: true,
      }
    });

    if (!issueRecord) {
      throw new AppError('NOT_FOUND', `Issue ${parseResult.data.id} not found`, 404);
    }

    return reply.send({ data: issueRecord });
  });

  // PATCH /api/v1/issues/:id - UPDATE BUG / FINDING STATUS & DETAILS
  fastify.patch('/api/v1/issues/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramParse = idParamSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid issue ID format', 400);
    }

    const bodyParse = updateIssueSchema.safeParse(request.body);
    if (!bodyParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid update issue payload', 400);
    }

    const issueId = paramParse.data.id;
    const existing = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', `Issue ${issueId} not found`, 404);
    }

    const updateData: any = { ...bodyParse.data, updatedAt: new Date() };

    await db.update(issues).set(updateData).where(eq(issues.id, issueId));

    const updatedRecord = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        evidence: true,
        testResult: true,
        browserSession: true,
      }
    });

    return reply.send({ data: updatedRecord });
  });

  // POST /api/v1/issues/:id/analyze - TRIGGER AI ROOT CAUSE ANALYSIS
  fastify.post('/api/v1/issues/:id/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = idParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid issue ID format', 400);
    }

    const issueId = parseResult.data.id;
    const analysis = await analysisService.analyzeIssue(issueId);

    const updatedIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        evidence: true,
        testResult: true,
        browserSession: true,
      }
    });

    return reply.send({
      data: {
        issue: updatedIssue,
        analysis,
      }
    });
  });

  const codeFixService = new CodeFixService(db, aiProvider);

  // POST /api/v1/issues/:id/fix - GENERATE TARGETED CODE FIX PROPOSAL
  fastify.post('/api/v1/issues/:id/fix', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramParse = idParamSchema.safeParse(request.params);
    if (!paramParse.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid issue ID format', 400);
    }

    const bodyParse = codeFixInputSchema.safeParse(request.body || {});
    if (!bodyParse.success) {
      const msg = bodyParse.error.issues[0]?.message || 'Invalid code fix request payload';
      throw new AppError('VALIDATION_ERROR', msg, 400);
    }

    const issueId = paramParse.data.id;
    const proposal = await codeFixService.generateFixProposal(issueId, bodyParse.data);

    return reply.send({
      data: {
        proposal,
      }
    });
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
