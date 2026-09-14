import { describe, expect, it, vi } from 'vitest';
import { createInMemoryDb } from '../../src/infrastructure/db/in-memory-db.js';
import { projects } from '../../src/infrastructure/db/schema.js';
import { BrowserWorkerService } from '../../src/modules/browser-workers/browser-worker.service.js';

const config = {
  NODE_ENV: 'test',
  BROWSER_ACTION_TIMEOUT_MS: 3000,
  BROWSER_NAVIGATION_TIMEOUT_MS: 5000,
  MAX_CONCURRENT_SESSIONS: 2,
} as any;

describe('Browser Worker manual persistence flow', () => {
  it('creates, lists and updates a manual worker without Gemini', async () => {
    const db = createInMemoryDb();
    const [project] = await db.insert(projects).values({
      name: 'DSE Collector',
      targetUrl: 'https://dse-market-data-collector-g2f7.onrender.com/',
    }).returning();
    const manager = { createSession: vi.fn(), closeSession: vi.fn() };
    const service = new BrowserWorkerService(db, manager as any, config);

    const created = await service.createWorker({
      projectId: project.id,
      name: 'DSE Manual Worker',
      environment: 'production',
      scheduleType: 'on_demand',
      workflow: [{ type: 'navigate', url: '/' }],
    });

    const listed = await service.listWorkers();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);

    const updated = await service.updateWorker(created.id, {
      name: 'DSE Manual Worker Updated',
      scheduleType: 'hourly',
      workflow: [{ type: 'navigate', url: '/health' }],
    });
    expect(updated.name).toBe('DSE Manual Worker Updated');
    expect(updated.scheduleType).toBe('hourly');
    expect(updated.nextRunAt).toBeTruthy();
    expect(manager.createSession).not.toHaveBeenCalled();
  });
});
