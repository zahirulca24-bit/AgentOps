import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BugService } from '../../src/modules/bug/bug.service.js';
import path from 'path';
import { promises as fs } from 'fs';

const tempDir = path.resolve('./tmp/bug-test-storage');
let service: BugService;

beforeAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
  service = new BugService(tempDir);
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('BugService CRUD', () => {
  it('creates, retrieves, lists, and updates a bug', async () => {
    const bugData = {
      title: 'Sample bug',
      description: 'Test bug description',
      severity: 'high' as const,
      status: 'open' as const,
    };
    const created = await service.createBug(bugData);
    expect(created.id).toBeDefined();
    const fetched = await service.getBug(created.id);
    expect(fetched.title).toBe(bugData.title);
    const list = await service.listBugs();
    expect(list.length).toBeGreaterThan(0);
    const updated = await service.updateBug(created.id, { status: 'fixed' as const });
    expect(updated.status).toBe('fixed');
    const fetchedAgain = await service.getBug(created.id);
    expect(fetchedAgain.status).toBe('fixed');
  });
});
