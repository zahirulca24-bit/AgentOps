import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import type { BrowserManager } from '../../infrastructure/browser/browser.manager.js';
import type { EnvConfig } from '../../config/env.js';
import { projects, agentCommunicationLogs } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactObject, redactString } from '../../infrastructure/redact/redactSensitive.js';
import { ExecutionCredentialBrokerService, type TestUserCredential } from '../vault/execution-credential-broker.service.js';
import { browserWorkers, browserWorkerRuns, browserWorkerNotifications } from './browser-worker.schema.js';

export type BrowserWorkerSchedule = 'on_demand' | 'hourly' | 'daily' | 'weekly';
export type BrowserWorkerStatus = 'idle' | 'running' | 'paused' | 'error';
export type BrowserWorkerTrigger = 'manual' | 'scheduled';

export type BrowserWorkerWorkflowStep =
  | { type: 'login' }
  | { type: 'navigate'; url: string }
  | { type: 'click'; selector: string }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'submit'; selector: string }
  | { type: 'wait'; timeoutMs?: number }
  | { type: 'logout'; selector?: string };

export interface BrowserWorkerLoginConfig {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  logoutSelector?: string;
}

export interface CreateBrowserWorkerInput {
  projectId: string;
  name: string;
  environment: string;
  targetUrl?: string;
  scheduleType: BrowserWorkerSchedule;
  credentialSecretRef?: string | null;
  loginConfig?: BrowserWorkerLoginConfig | null;
  workflow?: BrowserWorkerWorkflowStep[];
}

export type UpdateBrowserWorkerInput = Partial<Omit<CreateBrowserWorkerInput, 'projectId'>>;

export interface BrowserWorkerMetrics {
  functionalFailures: number;
  visualDefects: number;
  consoleErrors: number;
  networkFailures: number;
  totalFailures: number;
}

export interface BrowserWorkerComparison {
  status: 'first_run' | 'unchanged' | 'improved' | 'regressed';
  baselineRunId: string | null;
  previousStatus: string | null;
  currentStatus: string;
  deltas: {
    totalFailures: number;
    visualDefects: number;
    consoleErrors: number;
    networkFailures: number;
  };
}

export function computeNextBrowserWorkerRun(schedule: BrowserWorkerSchedule, from: Date = new Date()): Date | null {
  if (schedule === 'on_demand') return null;
  const next = new Date(from.getTime());
  if (schedule === 'hourly') next.setHours(next.getHours() + 1);
  if (schedule === 'daily') next.setDate(next.getDate() + 1);
  if (schedule === 'weekly') next.setDate(next.getDate() + 7);
  return next;
}

export function compareBrowserWorkerRuns(
  currentStatus: string,
  current: BrowserWorkerMetrics,
  previous?: { id: string; status: string; metrics?: BrowserWorkerMetrics | null } | null,
): BrowserWorkerComparison {
  const previousMetrics = previous?.metrics || null;
  if (!previous || !previousMetrics) {
    return {
      status: 'first_run',
      baselineRunId: null,
      previousStatus: null,
      currentStatus,
      deltas: {
        totalFailures: current.totalFailures,
        visualDefects: current.visualDefects,
        consoleErrors: current.consoleErrors,
        networkFailures: current.networkFailures,
      },
    };
  }

  const deltas = {
    totalFailures: current.totalFailures - previousMetrics.totalFailures,
    visualDefects: current.visualDefects - previousMetrics.visualDefects,
    consoleErrors: current.consoleErrors - previousMetrics.consoleErrors,
    networkFailures: current.networkFailures - previousMetrics.networkFailures,
  };

  let status: BrowserWorkerComparison['status'] = 'unchanged';
  if (previous.status === 'passed' && currentStatus !== 'passed') status = 'regressed';
  else if (previous.status !== 'passed' && currentStatus === 'passed') status = 'improved';
  else if (deltas.totalFailures > 0) status = 'regressed';
  else if (deltas.totalFailures < 0) status = 'improved';

  return {
    status,
    baselineRunId: previous.id,
    previousStatus: previous.status,
    currentStatus,
    deltas,
  };
}

function normalizeTargetUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Browser Worker target URL is malformed', 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('VALIDATION_ERROR', 'Browser Worker target URL must use http or https', 400);
  }
  return parsed.toString();
}

function toDate(value: any): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortNewest<T extends { startedAt?: any; createdAt?: any }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aTime = toDate(a.startedAt || a.createdAt)?.getTime() || 0;
    const bTime = toDate(b.startedAt || b.createdAt)?.getTime() || 0;
    return bTime - aTime;
  });
}

export class BrowserWorkerService {
  private credentialBroker: ExecutionCredentialBrokerService;

  constructor(
    private db: Database,
    private browserManager: BrowserManager,
    private config: EnvConfig,
    credentialBroker?: ExecutionCredentialBrokerService,
  ) {
    this.credentialBroker = credentialBroker || new ExecutionCredentialBrokerService(db);
  }

  private async findWorkerRecord(workerId: string): Promise<any> {
    const rows = await this.db.select().from(browserWorkers).where(eq(browserWorkers.id, workerId));
    return rows[0] || null;
  }

  private async findProject(projectId: string): Promise<any> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, projectId));
    return rows[0] || null;
  }

  private async workerRuns(workerId: string): Promise<any[]> {
    const rows = await this.db.select().from(browserWorkerRuns).where(eq(browserWorkerRuns.workerId, workerId));
    return sortNewest(rows);
  }

  private async hydrateWorker(record: any): Promise<any> {
    const project = await this.findProject(record.projectId);
    const history = await this.workerRuns(record.id);
    const lastRun = history[0] || null;
    return redactObject({
      ...record,
      project: project ? { id: project.id, name: project.name, targetUrl: project.targetUrl } : null,
      lastRun,
    });
  }

  public async listWorkers(): Promise<any[]> {
    const rows = await this.db.select().from(browserWorkers).orderBy(desc(browserWorkers.createdAt));
    return Promise.all(rows.map((row: any) => this.hydrateWorker(row)));
  }

  public async getWorker(workerId: string): Promise<any> {
    const record = await this.findWorkerRecord(workerId);
    if (!record) throw new AppError('NOT_FOUND', `Browser Worker ${workerId} not found`, 404);
    return this.hydrateWorker(record);
  }

  public async getHistory(workerId: string): Promise<any[]> {
    const worker = await this.findWorkerRecord(workerId);
    if (!worker) throw new AppError('NOT_FOUND', `Browser Worker ${workerId} not found`, 404);
    return redactObject(await this.workerRuns(workerId));
  }

  public async createWorker(input: CreateBrowserWorkerInput): Promise<any> {
    const project = await this.findProject(input.projectId);
    if (!project) throw new AppError('NOT_FOUND', `Project ${input.projectId} not found`, 404);

    const targetUrl = normalizeTargetUrl(input.targetUrl || project.targetUrl || '');
    if (input.credentialSecretRef && !input.loginConfig) {
      throw new AppError('VALIDATION_ERROR', 'Login configuration is required when credentialSecretRef is configured', 400);
    }

    const workflow = input.workflow?.length
      ? input.workflow
      : [{ type: 'navigate', url: targetUrl } satisfies BrowserWorkerWorkflowStep];
    const now = new Date();
    const [created] = await this.db.insert(browserWorkers).values({
      projectId: input.projectId,
      name: input.name.trim(),
      environment: input.environment.trim(),
      targetUrl,
      scheduleType: input.scheduleType,
      status: 'idle',
      currentAction: 'Waiting for dispatch',
      credentialSecretRef: input.credentialSecretRef || null,
      loginConfig: input.loginConfig || null,
      workflow,
      nextRunAt: computeNextBrowserWorkerRun(input.scheduleType, now),
      createdAt: now,
      updatedAt: now,
    }).returning();

    return this.hydrateWorker(created);
  }

  public async updateWorker(workerId: string, input: UpdateBrowserWorkerInput): Promise<any> {
    const existing = await this.findWorkerRecord(workerId);
    if (!existing) throw new AppError('NOT_FOUND', `Browser Worker ${workerId} not found`, 404);
    if (existing.status === 'running') {
      throw new AppError('CONFLICT', 'Browser Worker cannot be edited while a run is active', 409);
    }

    const scheduleType = input.scheduleType || existing.scheduleType as BrowserWorkerSchedule;
    const credentialSecretRef = input.credentialSecretRef === undefined ? existing.credentialSecretRef : input.credentialSecretRef;
    const loginConfig = input.loginConfig === undefined ? existing.loginConfig : input.loginConfig;
    if (credentialSecretRef && !loginConfig) {
      throw new AppError('VALIDATION_ERROR', 'Login configuration is required when credentialSecretRef is configured', 400);
    }

    const update: any = {
      updatedAt: new Date(),
      nextRunAt: existing.status === 'paused' ? null : computeNextBrowserWorkerRun(scheduleType, new Date()),
    };
    if (input.name !== undefined) update.name = input.name.trim();
    if (input.environment !== undefined) update.environment = input.environment.trim();
    if (input.targetUrl !== undefined) update.targetUrl = normalizeTargetUrl(input.targetUrl);
    if (input.scheduleType !== undefined) update.scheduleType = input.scheduleType;
    if (input.credentialSecretRef !== undefined) update.credentialSecretRef = input.credentialSecretRef || null;
    if (input.loginConfig !== undefined) update.loginConfig = input.loginConfig || null;
    if (input.workflow !== undefined) update.workflow = input.workflow;

    await this.db.update(browserWorkers).set(update).where(eq(browserWorkers.id, workerId));
    return this.getWorker(workerId);
  }

  public async pauseWorker(workerId: string): Promise<any> {
    const worker = await this.findWorkerRecord(workerId);
    if (!worker) throw new AppError('NOT_FOUND', `Browser Worker ${workerId} not found`, 404);
    await this.db.update(browserWorkers).set({
      status: 'paused',
      currentAction: worker.status === 'running' ? 'Paused after current run' : 'Paused',
      nextRunAt: null,
      updatedAt: new Date(),
    }).where(eq(browserWorkers.id, workerId));
    return this.getWorker(workerId);
  }

  public async resumeWorker(workerId: string): Promise<any> {
    const worker = await this.findWorkerRecord(workerId);
    if (!worker) throw new AppError('NOT_FOUND', `Browser Worker ${workerId} not found`, 404);
    if (worker.status !== 'paused') return this.getWorker(workerId);
    const scheduleType = worker.scheduleType as BrowserWorkerSchedule;
    await this.db.update(browserWorkers).set({
      status: 'idle',
      currentAction: 'Waiting for dispatch',
      nextRunAt: computeNextBrowserWorkerRun(scheduleType, new Date()),
      updatedAt: new Date(),
    }).where(eq(browserWorkers.id, workerId));
    return this.getWorker(workerId);
  }

  private async setCurrentAction(workerId: string, workerRunId: string, action: string): Promise<void> {
    const safeAction = redactString(action).slice(0, 500);
    await Promise.all([
      this.db.update(browserWorkers).set({ currentAction: safeAction, updatedAt: new Date() }).where(eq(browserWorkers.id, workerId)),
      this.db.update(browserWorkerRuns).set({ currentAction: safeAction }).where(eq(browserWorkerRuns.id, workerRunId)),
    ]);
  }

  private async previousCompletedRun(workerId: string, currentRunId: string): Promise<any | null> {
    const history = await this.workerRuns(workerId);
    return history.find((run: any) => run.id !== currentRunId && run.status !== 'running') || null;
  }

  private resolveWorkflowUrl(workerTargetUrl: string, candidate: string): string {
    try {
      return normalizeTargetUrl(new URL(candidate, workerTargetUrl).toString());
    } catch {
      throw new AppError('VALIDATION_ERROR', 'Browser Worker workflow contains an invalid navigation URL', 400);
    }
  }

  private async notifyImportantFailure(worker: any, project: any, workerRun: any, report: any): Promise<void> {
    const metrics = report.metrics as BrowserWorkerMetrics;
    const message = redactString(
      `Browser Worker '${worker.name}' reported an important ${workerRun.status} result for ${project?.name || 'project'} (${worker.environment}). ` +
      `Functional failures: ${metrics.functionalFailures}; visual defects: ${metrics.visualDefects}; console errors: ${metrics.consoleErrors}; network failures: ${metrics.networkFailures}. ` +
      `Regression: ${report.comparison.status}. Review Browser Worker history for the report.`
    );
    const title = redactString(`Browser Worker failure: ${worker.name}`).slice(0, 250);

    await Promise.all([
      this.db.insert(browserWorkerNotifications).values({
        workerId: worker.id,
        workerRunId: workerRun.id,
        severity: workerRun.status === 'error' ? 'critical' : 'high',
        title,
        message,
        createdAt: new Date(),
      }),
      this.db.insert(agentCommunicationLogs).values({
        speaker: 'Browser Worker',
        recipient: 'Chief of Staff',
        agent: 'qa',
        message,
        createdAt: new Date(),
      }),
    ]);
  }

  public async listNotifications(unreadOnly: boolean = false): Promise<any[]> {
    const rows = await this.db.select().from(browserWorkerNotifications).orderBy(desc(browserWorkerNotifications.createdAt));
    const filtered = unreadOnly ? rows.filter((row: any) => !row.readAt) : rows;
    return redactObject(filtered);
  }

  public async markAllNotificationsRead(): Promise<void> {
    const rows = await this.db.select().from(browserWorkerNotifications);
    const now = new Date();
    await Promise.all(rows.filter((row: any) => !row.readAt).map((row: any) =>
      this.db.update(browserWorkerNotifications).set({ readAt: now }).where(eq(browserWorkerNotifications.id, row.id))
    ));
  }

  public async triggerWorker(
    workerId: string,
    trigger: BrowserWorkerTrigger = 'manual',
    background: boolean = true,
  ): Promise<any> {
    const worker = await this.findWorkerRecord(workerId);
    if (!worker) throw new AppError('NOT_FOUND', `Browser Worker ${workerId} not found`, 404);
    if (worker.status === 'paused') throw new AppError('CONFLICT', 'Browser Worker is paused. Resume it before running.', 409);
    if (worker.status === 'running') throw new AppError('CONFLICT', 'Browser Worker already has an active run', 409);

    const existingRuns = await this.workerRuns(workerId);
    if (existingRuns.some((run: any) => run.status === 'running')) {
      throw new AppError('CONFLICT', 'Browser Worker already has an active run', 409);
    }

    const now = new Date();
    let startedRun: any;
    try {
      [startedRun] = await this.db.insert(browserWorkerRuns).values({
        workerId,
        trigger,
        status: 'running',
        currentAction: 'Starting browser session',
        importantFailure: false,
        startedAt: now,
        createdAt: now,
      }).returning();
    } catch (error: any) {
      if (error?.code === '23505' || String(error?.message || '').includes('browser_worker_runs_one_running_idx')) {
        throw new AppError('CONFLICT', 'Browser Worker already has an active run', 409);
      }
      throw error;
    }

    await this.db.update(browserWorkers).set({
      status: 'running',
      currentAction: 'Starting browser session',
      lastRunId: startedRun.id,
      updatedAt: now,
    }).where(eq(browserWorkers.id, workerId));

    if (background) {
      void this.executePreparedRun(worker, startedRun).catch(() => undefined);
      return redactObject(startedRun);
    }
    return this.executePreparedRun(worker, startedRun);
  }

  private async executePreparedRun(worker: any, startedRun: any): Promise<any> {
    const project = await this.findProject(worker.projectId);
    let session: any = null;
    let credential: TestUserCredential | null = null;
    let loggedIn = false;
    let loggedOut = false;
    let functionalError: string | null = null;
    let visualDefects: any[] = [];
    let consoleErrors: any[] = [];
    let networkFailures: any[] = [];
    const actions: string[] = [];

    const runLogin = async () => {
      if (!worker.credentialSecretRef || !worker.loginConfig) {
        throw new AppError('VALIDATION_ERROR', 'Browser Worker login requires credentialSecretRef and loginConfig', 400);
      }
      if (!credential) {
        await this.setCurrentAction(worker.id, startedRun.id, 'Resolving test-user credential from Credential Vault');
        credential = await this.credentialBroker.resolveTestUser(worker.credentialSecretRef, `browser-worker:${worker.id}`);
      }
      const config = worker.loginConfig as BrowserWorkerLoginConfig;
      await this.setCurrentAction(worker.id, startedRun.id, 'Logging in as configured test user');
      await session.navigate({ url: this.resolveWorkflowUrl(worker.targetUrl, config.loginUrl) });
      await session.fill({ selector: config.usernameSelector, value: credential.username });
      await session.fill({ selector: config.passwordSelector, value: credential.password });
      await session.click({ selector: config.submitSelector });
      await session.wait({ timeoutMs: 500 });
      loggedIn = true;
      actions.push('login');
    };

    const runLogout = async (selector?: string) => {
      const logoutSelector = selector || (worker.loginConfig as BrowserWorkerLoginConfig | null)?.logoutSelector;
      if (!logoutSelector) return;
      await this.setCurrentAction(worker.id, startedRun.id, 'Logging out test user');
      await session.click({ selector: logoutSelector });
      loggedOut = true;
      actions.push('logout');
    };

    try {
      session = await this.browserManager.createSession();
      const workflow = Array.isArray(worker.workflow) ? worker.workflow as BrowserWorkerWorkflowStep[] : [];
      const hasExplicitLogin = workflow.some((step) => step.type === 'login');

      if (worker.credentialSecretRef && worker.loginConfig && !hasExplicitLogin) await runLogin();

      for (const step of workflow) {
        if (step.type === 'login') {
          await runLogin();
        } else if (step.type === 'navigate') {
          await this.setCurrentAction(worker.id, startedRun.id, `Navigating to ${this.resolveWorkflowUrl(worker.targetUrl, step.url)}`);
          await session.navigate({ url: this.resolveWorkflowUrl(worker.targetUrl, step.url) });
          actions.push('navigate');
        } else if (step.type === 'click') {
          await this.setCurrentAction(worker.id, startedRun.id, `Clicking ${step.selector}`);
          await session.click({ selector: step.selector });
          actions.push('click');
        } else if (step.type === 'fill') {
          await this.setCurrentAction(worker.id, startedRun.id, `Filling ${step.selector}`);
          await session.fill({ selector: step.selector, value: step.value });
          actions.push('fill');
        } else if (step.type === 'submit') {
          await this.setCurrentAction(worker.id, startedRun.id, `Submitting ${step.selector}`);
          await session.click({ selector: step.selector });
          actions.push('submit');
        } else if (step.type === 'wait') {
          await this.setCurrentAction(worker.id, startedRun.id, 'Waiting for page state');
          await session.wait({ timeoutMs: Math.min(Math.max(step.timeoutMs || 500, 0), this.config.BROWSER_ACTION_TIMEOUT_MS) });
          actions.push('wait');
        } else if (step.type === 'logout') {
          await runLogout(step.selector);
        }
      }

      await this.setCurrentAction(worker.id, startedRun.id, 'Running visual checks');
      visualDefects = redactObject(await session.evaluateVisualQA());

      if (loggedIn && !loggedOut) {
        try {
          await runLogout();
        } catch (error: any) {
          functionalError = redactString(error?.message || 'Test-user logout failed');
        }
      }

      await this.setCurrentAction(worker.id, startedRun.id, 'Analyzing console and network activity');
      const logs = session.getLogs();
      consoleErrors = redactObject((logs.console || [])
        .filter((entry: any) => ['error', 'assert'].includes(String(entry.type).toLowerCase()))
        .map((entry: any) => ({ type: entry.type, text: redactString(entry.text), location: redactString(entry.location || ''), timestamp: entry.timestamp })));
      networkFailures = redactObject((logs.network || [])
        .filter((entry: any) => Number(entry.status || 0) >= 400)
        .map((entry: any) => ({ url: redactString(entry.url), method: entry.method, status: entry.status, timestamp: entry.timestamp })));
    } catch (error: any) {
      functionalError = redactString(error?.message || 'Browser Worker execution failed');
    } finally {
      if (session) {
        if (loggedIn && !loggedOut) {
          try { await runLogout(); } catch {}
        }
        try { await this.browserManager.closeSession(session.sessionId); } catch {}
      }
    }

    const functionalFailures = functionalError ? 1 : 0;
    const metrics: BrowserWorkerMetrics = {
      functionalFailures,
      visualDefects: visualDefects.length,
      consoleErrors: consoleErrors.length,
      networkFailures: networkFailures.length,
      totalFailures: functionalFailures + visualDefects.length + consoleErrors.length + networkFailures.length,
    };
    const status = functionalError && !actions.length ? 'error' : metrics.totalFailures > 0 ? 'failed' : 'passed';
    const previous = await this.previousCompletedRun(worker.id, startedRun.id);
    const comparison = compareBrowserWorkerRuns(status, metrics, previous ? {
      id: previous.id,
      status: previous.status,
      metrics: previous.metrics as BrowserWorkerMetrics | null,
    } : null);
    const importantFailure = status !== 'passed' || comparison.status === 'regressed';
    const completedAt = new Date();
    const report = redactObject({
      workerId: worker.id,
      workerRunId: startedRun.id,
      project: project ? { id: project.id, name: project.name } : null,
      environment: worker.environment,
      targetUrl: worker.targetUrl,
      schedule: worker.scheduleType,
      trigger: startedRun.trigger,
      status,
      startedAt: startedRun.startedAt,
      completedAt: completedAt.toISOString(),
      credential: worker.credentialSecretRef ? { used: Boolean(loggedIn), secretRef: worker.credentialSecretRef } : { used: false },
      actions,
      checks: {
        functional: { status: functionalError ? 'failed' : 'passed', error: functionalError },
        visual: { status: visualDefects.length ? 'failed' : 'passed', defects: visualDefects },
        console: { status: consoleErrors.length ? 'failed' : 'passed', errors: consoleErrors },
        network: { status: networkFailures.length ? 'failed' : 'passed', failures: networkFailures },
        regression: comparison,
      },
      metrics,
      comparison,
    });
    const summary = status === 'passed'
      ? `All Browser Worker checks passed. Regression comparison: ${comparison.status}.`
      : `Browser Worker completed with ${metrics.totalFailures} failure signal(s). Regression comparison: ${comparison.status}.`;

    await this.db.update(browserWorkerRuns).set({
      status,
      currentAction: 'Completed',
      summary: redactString(summary),
      metrics,
      comparison,
      report,
      importantFailure,
      completedAt,
    }).where(eq(browserWorkerRuns.id, startedRun.id));

    const latestWorker = await this.findWorkerRecord(worker.id);
    const remainsPaused = latestWorker?.status === 'paused';
    const nextRunAt = remainsPaused ? null : computeNextBrowserWorkerRun(worker.scheduleType as BrowserWorkerSchedule, completedAt);
    await this.db.update(browserWorkers).set({
      status: remainsPaused ? 'paused' : status === 'error' ? 'error' : 'idle',
      currentAction: remainsPaused ? 'Paused' : status === 'passed' ? 'Waiting for dispatch' : 'Last run requires attention',
      lastRunId: startedRun.id,
      lastRunAt: completedAt,
      nextRunAt,
      updatedAt: completedAt,
    }).where(eq(browserWorkers.id, worker.id));

    const finalRun = (await this.workerRuns(worker.id)).find((run: any) => run.id === startedRun.id) || { ...startedRun, status, report, metrics, comparison };
    if (importantFailure) {
      try { await this.notifyImportantFailure(worker, project, finalRun, report); } catch {}
    }
    return redactObject(finalRun);
  }

  public async runDueWorkers(now: Date = new Date()): Promise<string[]> {
    const rows = await this.db.select().from(browserWorkers);
    const due = rows.filter((worker: any) => {
      if (worker.scheduleType === 'on_demand' || worker.status === 'paused' || worker.status === 'running') return false;
      const nextRun = toDate(worker.nextRunAt);
      return Boolean(nextRun && nextRun.getTime() <= now.getTime());
    });

    const started: string[] = [];
    for (const worker of due) {
      try {
        await this.triggerWorker(worker.id, 'scheduled', true);
        started.push(worker.id);
      } catch (error: any) {
        if (!(error instanceof AppError && error.code === 'CONFLICT')) {
          await this.db.update(browserWorkers).set({
            status: 'error',
            currentAction: redactString(error?.message || 'Scheduled dispatch failed'),
            nextRunAt: computeNextBrowserWorkerRun(worker.scheduleType as BrowserWorkerSchedule, now),
            updatedAt: now,
          }).where(eq(browserWorkers.id, worker.id));
        }
      }
    }
    return started;
  }
}

export class BrowserWorkerScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private service: BrowserWorkerService) {}

  public start(intervalMs: number = 60_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.service.runDueWorkers().catch(() => undefined);
    }, intervalMs);
    (this.timer as any).unref?.();
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  public tick(now: Date = new Date()): Promise<string[]> {
    return this.service.runDueWorkers(now);
  }
}
