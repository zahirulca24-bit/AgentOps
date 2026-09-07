import { z } from 'zod';

export const executeQuerySchema = z.object({
  query: z.string().trim().min(1, 'SQL query string is required'),
  actor: z.string().trim().optional().default('system'),
  maxRows: z.number().int().positive().max(1000).optional().default(100),
  timeoutMs: z.number().int().positive().max(30000).optional().default(5000),
});
export type ExecuteQueryInput = z.infer<typeof executeQuerySchema>;

export const executeMigrationSchema = z.object({
  migrationSql: z.string().trim().min(1, 'Migration SQL DDL is required'),
  actor: z.string().trim().min(1, 'Actor identity is required for migration'),
  resourceId: z.string().optional(),
  reason: z.string().optional(),
});
export type ExecuteMigrationInput = z.infer<typeof executeMigrationSchema>;

export interface TableColumnMeta {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export interface TableSchemaMeta {
  tableName: string;
  columnCount: number;
  columns: TableColumnMeta[];
  indexes: string[];
}

export interface QueryResult {
  queryId: string;
  query: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL';
  permissionTier: 'Green' | 'Yellow' | 'Red';
  rowCount: number;
  executionTimeMs: number;
  rows: Record<string, any>[];
  fields: string[];
  executedAt: string;
}
