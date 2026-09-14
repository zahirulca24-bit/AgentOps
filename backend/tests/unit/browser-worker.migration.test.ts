import path from 'node:path';
import { describe, expect, it } from 'vitest';
import drizzleConfig from '../../drizzle.config.js';
import { migrationsFolder, runStartupMigrations } from '../../src/infrastructure/db/migrate.js';

describe('Browser Worker database migration wiring', () => {
  it('registers the Browser Worker schema with Drizzle generation', () => {
    const schemas = Array.isArray(drizzleConfig.schema) ? drizzleConfig.schema : [drizzleConfig.schema];
    expect(schemas).toContain('./src/infrastructure/db/schema.ts');
    expect(schemas).toContain('./src/modules/browser-workers/browser-worker.schema.ts');
  });

  it('resolves the checked-in drizzle migration folder independent of process cwd', () => {
    expect(path.basename(migrationsFolder)).toBe('drizzle');
    expect(path.basename(path.dirname(migrationsFolder))).toBe('backend');
  });

  it('does not attempt production migrations in test mode', async () => {
    await expect(runStartupMigrations({ NODE_ENV: 'test' } as any)).resolves.toBeUndefined();
  });
});
