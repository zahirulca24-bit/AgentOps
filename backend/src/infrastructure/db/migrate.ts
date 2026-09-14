import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { EnvConfig } from '../../config/env.js';
import { createDbClient } from './client.js';

export const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));

export async function runStartupMigrations(config: EnvConfig): Promise<void> {
  if (config.NODE_ENV === 'test') return;

  const client = createDbClient(config);
  try {
    await migrate(client.realDb, { migrationsFolder });
  } finally {
    await client.close();
  }
}
