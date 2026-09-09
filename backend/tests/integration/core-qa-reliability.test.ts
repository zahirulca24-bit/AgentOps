import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createInMemoryDb } from '../../src/infrastructure/db/in-memory-db.js';
import { projects, tasks, runs, testCases } from '../../src/infrastructure/db/schema.js';
import { ExecutionService } from '../../src/modules/execution/execution.service.js';
import { deriveExecutionRootCause } from '../../src/modules/execution/root-cause.js';

const evidenceDirs: string[] = [];

function config() {
  const evidenceDir = path.join(process.cwd(), `.test-evidence-core-qa-${crypto.randomUUID()}`);
  evidenceDirs.push(evidenceDir);
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 3001,
    LOG_LEVEL: 'silent',
    CORS_ORIGINS: ['http://localhost:3000'],
    DATABASE_URL: 'postgresql://unused',
    AI_MODEL: 'test',
    MAX_CONCURRENT_SESSIONS: 2,
    BROWSER_ACTION_TIMEOUT_MS: 3000,
    BROWSER_NAVIGATION_TIMEOUT_MS: 5000,
    MAX_EXPLORATION_PAGES: 3,
    MAX_EXPLORATION_DEPTH: 2,
    MAX_TESTS_PER_RUN: 5,
    MAX_STEPS_PER_TEST: 10,
    MAX_ASSERTIONS_PER_TEST: 5,
    MAX_RUN_TIMEOUT_MS: 300000,
    MAX_TEST_TIMEOUT_MS: 30000,
    EVIDENCE_STORAGE_DIR: evidenceDir,
    MAX_EVIDENCE_SIZE_MB: 10,
  } as any;
}

async function seedRun(db: any, options: { targetUrl?: string | null; command?: string; testCount?: number }) {
  const [project] = await db.insert(projects).values({
    name: 'Reliability Project',
    targetUrl: options.targetUrl ?? null,
  }).returning();
  const [task] = await db.insert(tasks).values({
    projectId: project.id,
    command: options.command || 'Run QA',
    targetUrl: null,
    status: 'running',
  }).returning();
  const [run] = await db.insert(runs).values({ taskId: task.id, status: 'pending' }).returning();

  const count = options.testCount ?? 1;
  await db.insert(testCases).values(Array.from({ length: count }, (_, index) => ({
    runId: run.id,
    name: `Reliability Test ${index + 1}`,
    category: 'functional',
    priority: 'high',
    steps: [{ action: 'navigate' }],
    assertions: [{ type: 'element_visible', target: 'body' }],
  })));

  return { project, task, run };
}

function passingBrowser() {
  const session = {
    sessionId: 'worker-1',
    navigate: vi.fn(async () => undefined),
    click: vi.fn(async () => undefined),
    fill: vi.fn(async () => undefined),
    select: vi.fn(async () => undefined),
    scroll: vi.fn(async () => undefined),
    wait: vi.fn(async () => undefined),
    evaluateVisualQA: vi.fn(async () => []),
    evaluateAssertion: vi.fn(async () => ({ pass: true, actual: 'visible' })),
    screenshot: vi.fn(),
    getLogs: vi.fn(() => ({ console: [], network: [] })),
  };
  const manager = {
    createSession: vi.fn(async () => session),
    closeSession: vi.fn(async () => undefined),
  };
  return { session, manager };
}

afterEach(async () => {
  await Promise.all(evidenceDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('core QA reliability', () => {
  it('propagates project target URL through executor and emits final report evidence on success', async () => {
    const db = createInMemoryDb();
    const { task, run } = await seedRun(db, { targetUrl: 'https://example.com/app' });
    const { session, manager } = passingBrowser();
    const service = new ExecutionService(db, manager as any, config());

    await service.executeRun(run.id);

    expect(session.navigate).toHaveBeenCalledWith({ url: 'https://example.com/app' });
    const updatedRun = await db.query.runs.findFirst({ where: (item: any) => item.id === run.id });
    const updatedTask = await db.query.tasks.findFirst({ where: (item: any) => item.id === task.id });
    const results = await db.query.testResults.findMany({ where: (item: any) => item.runId === run.id });
    const storedEvidence = await db.query.evidence.findMany({ where: (item: any) => item.runId === run.id });

    expect(updatedRun.status).toBe('passed');
    expect(updatedTask.status).toBe('completed');
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('passed');
    expect(storedEvidence.some((item: any) => item.type === 'run_report')).toBe(true);
  });

  it('creates one root issue when one missing target URL would otherwise fail many tests', async () => {
    const db = createInMemoryDb();
    const { task, run } = await seedRun(db, { targetUrl: null, command: 'Run QA without a configured URL', testCount: 3 });
    const { manager } = passingBrowser();
    const service = new ExecutionService(db, manager as any, config());

    await service.executeRun(run.id);

    const updatedRun = await db.query.runs.findFirst({ where: (item: any) => item.id === run.id });
    const updatedTask = await db.query.tasks.findFirst({ where: (item: any) => item.id === task.id });
    const rootIssues = await db.query.issues.findMany({ where: (item: any) => item.runId === run.id });
    const results = await db.query.testResults.findMany({ where: (item: any) => item.runId === run.id });

    expect(manager.createSession).not.toHaveBeenCalled();
    expect(updatedRun.status).toBe('error');
    expect(updatedTask.status).toBe('failed');
    expect(results).toHaveLength(0);
    expect(rootIssues).toHaveLength(1);
    expect(rootIssues[0].rootCauseAnalysis.rootCauseKey).toBe('target-url-propagation');
  });

  it('finalizes run/task state and report evidence when execution infrastructure fails', async () => {
    const db = createInMemoryDb();
    const { task, run } = await seedRun(db, { targetUrl: 'https://example.com' });
    const manager = {
      createSession: vi.fn(async () => { throw new Error('browser worker unavailable'); }),
      closeSession: vi.fn(),
    };
    const service = new ExecutionService(db, manager as any, config());

    await service.executeRun(run.id);

    const updatedRun = await db.query.runs.findFirst({ where: (item: any) => item.id === run.id });
    const updatedTask = await db.query.tasks.findFirst({ where: (item: any) => item.id === task.id });
    const storedEvidence = await db.query.evidence.findMany({ where: (item: any) => item.runId === run.id });

    expect(updatedRun.status).toBe('error');
    expect(updatedTask.status).toBe('failed');
    expect(storedEvidence.some((item: any) => item.type === 'run_report')).toBe(true);
  });

  it('fingerprints URL propagation symptoms as one real root cause', () => {
    expect(deriveExecutionRootCause('Invalid URL format').key).toBe('target-url-propagation');
    expect(deriveExecutionRootCause('Target URL is malformed').key).toBe('target-url-propagation');
  });
});
