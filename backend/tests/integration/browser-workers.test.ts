import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createInMemoryDb } from '../../src/infrastructure/db/in-memory-db.js';
import { agentCommunicationLogs, projects, vaultCredentials } from '../../src/infrastructure/db/schema.js';
import {
  BrowserWorkerService,
  type BrowserWorkerMetrics,
} from '../../src/modules/browser-workers/browser-worker.service.js';
import { browserWorkers } from '../../src/modules/browser-workers/browser-worker.schema.js';

const config = {
  NODE_ENV: 'test',
  BROWSER_ACTION_TIMEOUT_MS: 3000,
  BROWSER_NAVIGATION_TIMEOUT_MS: 5000,
  MAX_CONCURRENT_SESSIONS: 2,
} as any;

function makeSession(options?: { failing?: boolean; username?: string; password?: string }) {
  const username = options?.username || 'qa.user@example.com';
  const password = options?.password || 'VerySecretPassword!';
  return {
    sessionId: `session-${Math.random()}`,
    navigate: vi.fn(async () => ({ status: 200 })),
    click: vi.fn(async () => ({ success: true })),
    fill: vi.fn(async () => ({ success: true })),
    wait: vi.fn(async () => ({ success: true })),
    evaluateVisualQA: vi.fn(async () => options?.failing ? [{
      type: 'overflow', severity: 'medium', title: 'Overflow', description: 'Page overflow detected', selector: '#main',
    }] : []),
    getLogs: vi.fn(() => options?.failing ? {
      console: [{ type: 'error', text: `Login debug ${username} ${password}`, timestamp: new Date().toISOString() }],
      network: [{ url: `https://${username}:${password}@example.com/api`, method: 'GET', status: 500, timestamp: new Date().toISOString() }],
    } : { console: [], network: [] }),
  };
}

async function seedProjectAndCredential(db: any) {
  const [project] = await db.insert(projects).values({
    name: 'Customer Portal',
    targetUrl: 'https://example.com/app',
  }).returning();

  const username = 'qa.user@example.com';
  const password = 'VerySecretPassword!';
  const raw = JSON.stringify({ username, password });
  await db.insert(vaultCredentials).values({
    secretRef: 'sec_ref_generic_browser_test_v1',
    provider: 'generic',
    encryptedValue: Buffer.from(raw, 'utf-8').toString('base64'),
    version: 1,
    status: 'active',
    description: 'Browser Worker test user',
  });

  return { project, username, password, raw };
}

function workerInput(projectId: string) {
  return {
    projectId,
    name: 'Portal Regression Worker',
    environment: 'staging',
    scheduleType: 'daily' as const,
    credentialSecretRef: 'sec_ref_generic_browser_test_v1',
    loginConfig: {
      loginUrl: '/login',
      usernameSelector: '#email',
      passwordSelector: '#password',
      submitSelector: 'button[type="submit"]',
      logoutSelector: '#logout',
    },
    workflow: [
      { type: 'navigate' as const, url: '/account' },
      { type: 'click' as const, selector: '#edit-profile' },
      { type: 'fill' as const, selector: '#display-name', value: 'QA User' },
      { type: 'submit' as const, selector: '#save-profile' },
    ],
  };
}

describe('Browser Workers', () => {
  it('runs like a user with vault-backed login and never persists credentials', async () => {
    const db = createInMemoryDb();
    const { project, username, password, raw } = await seedProjectAndCredential(db);
    const session = makeSession({ username, password });
    const manager = {
      createSession: vi.fn(async () => session),
      closeSession: vi.fn(async () => undefined),
    };
    const service = new BrowserWorkerService(db, manager as any, config);
    const worker = await service.createWorker(workerInput(project.id));

    const run = await service.triggerWorker(worker.id, 'manual', false);
    const history = await service.getHistory(worker.id);
    const storedWorker = await service.getWorker(worker.id);

    expect(run.status).toBe('passed');
    expect(session.navigate).toHaveBeenCalledWith({ url: 'https://example.com/login' });
    expect(session.navigate).toHaveBeenCalledWith({ url: 'https://example.com/account' });
    expect(session.fill).toHaveBeenCalledWith({ selector: '#email', value: username });
    expect(session.fill).toHaveBeenCalledWith({ selector: '#password', value: password });
    expect(session.click).toHaveBeenCalledWith({ selector: 'button[type="submit"]' });
    expect(session.click).toHaveBeenCalledWith({ selector: '#save-profile' });
    expect(session.click).toHaveBeenCalledWith({ selector: '#logout' });
    expect(storedWorker.project.name).toBe('Customer Portal');
    expect(storedWorker.environment).toBe('staging');
    expect(storedWorker.lastRunAt).toBeTruthy();
    expect(storedWorker.nextRunAt).toBeTruthy();

    const persisted = JSON.stringify(history);
    expect(persisted).not.toContain(username);
    expect(persisted).not.toContain(password);
    expect(persisted).not.toContain(raw);
    expect(persisted).toContain('sec_ref_generic_browser_test_v1');
    expect(history[0].report.checks.functional.status).toBe('passed');
    expect(history[0].report.checks.visual.status).toBe('passed');
    expect(history[0].report.checks.console.status).toBe('passed');
    expect(history[0].report.checks.network.status).toBe('passed');
    expect(history[0].report.checks.regression.status).toBe('first_run');
  });

  it('compares with the previous run and notifies Chief of Staff plus bell data on regression', async () => {
    const db = createInMemoryDb();
    const { project, username, password } = await seedProjectAndCredential(db);
    const sessions = [
      makeSession({ username, password }),
      makeSession({ failing: true, username, password }),
    ];
    const manager = {
      createSession: vi.fn(async () => sessions.shift()!),
      closeSession: vi.fn(async () => undefined),
    };
    const service = new BrowserWorkerService(db, manager as any, config);
    const worker = await service.createWorker(workerInput(project.id));

    await service.triggerWorker(worker.id, 'manual', false);
    const second = await service.triggerWorker(worker.id, 'manual', false);

    expect(second.status).toBe('failed');
    expect(second.comparison.status).toBe('regressed');
    expect((second.metrics as BrowserWorkerMetrics).visualDefects).toBe(1);
    expect((second.metrics as BrowserWorkerMetrics).consoleErrors).toBe(1);
    expect((second.metrics as BrowserWorkerMetrics).networkFailures).toBe(1);

    const notifications = await service.listNotifications(true);
    const communications = await db.select().from(agentCommunicationLogs);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].workerId).toBe(worker.id);
    expect(communications.some((item: any) => item.recipient === 'Chief of Staff')).toBe(true);

    const persisted = JSON.stringify({ second, notifications, communications });
    expect(persisted).not.toContain(username);
    expect(persisted).not.toContain(password);
    expect(persisted).toContain('[REDACTED_VAULT_SECRET]');
  });

  it('supports pause/resume and blocks overlapping runs', async () => {
    const db = createInMemoryDb();
    const { project } = await seedProjectAndCredential(db);
    const never = new Promise<any>(() => undefined);
    const manager = {
      createSession: vi.fn(() => never),
      closeSession: vi.fn(async () => undefined),
    };
    const service = new BrowserWorkerService(db, manager as any, config);
    const worker = await service.createWorker({
      ...workerInput(project.id),
      scheduleType: 'hourly',
      credentialSecretRef: null,
      loginConfig: null,
      workflow: [{ type: 'navigate', url: '/health' }],
    });

    const paused = await service.pauseWorker(worker.id);
    expect(paused.status).toBe('paused');
    expect(paused.nextRunAt).toBeNull();
    await expect(service.triggerWorker(worker.id, 'manual', true)).rejects.toMatchObject({ code: 'CONFLICT' });

    const resumed = await service.resumeWorker(worker.id);
    expect(resumed.status).toBe('idle');
    expect(resumed.nextRunAt).toBeTruthy();

    await service.triggerWorker(worker.id, 'manual', true);
    await expect(service.triggerWorker(worker.id, 'manual', true)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('dispatches due scheduled workers and advances schedule metadata', async () => {
    const db = createInMemoryDb();
    const { project } = await seedProjectAndCredential(db);
    const session = makeSession();
    const manager = {
      createSession: vi.fn(async () => session),
      closeSession: vi.fn(async () => undefined),
    };
    const service = new BrowserWorkerService(db, manager as any, config);
    const worker = await service.createWorker({
      ...workerInput(project.id),
      credentialSecretRef: null,
      loginConfig: null,
      workflow: [{ type: 'navigate', url: '/status' }],
      scheduleType: 'hourly',
    });

    await db.update(browserWorkers).set({ nextRunAt: new Date('2026-09-09T23:00:00.000Z') }).where(eq(browserWorkers.id, worker.id));
    const started = await service.runDueWorkers(new Date('2026-09-10T00:00:00.000Z'));
    expect(started).toEqual([worker.id]);

    // Let the background execution finish its promise chain.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const updated = await service.getWorker(worker.id);
    expect(updated.lastRunAt).toBeTruthy();
    expect(updated.nextRunAt).toBeTruthy();
  });
});
