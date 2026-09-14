import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { EnvConfig } from '../../config/env.js';
import { createDbClient } from './client.js';

export async function runStartupMigrations(config: EnvConfig): Promise<void> {
  if (config.NODE_ENV === 'test') return;

  const client = createDbClient(config);
  try {
    await migrate(client.realDb, { migrationsFolder: './drizzle' });
  } finally {
    await client.close();
  }
}
