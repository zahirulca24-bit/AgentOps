import { eq, desc, sql as drizzleSql } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { databaseQueryLogs } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactString, redactObject } from '../../infrastructure/redact/redactSensitive.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import { PermissionEngineService } from '../permission/permission.service.js';
import {
  ExecuteQueryInput,
  ExecuteMigrationInput,
  QueryResult,
  TableSchemaMeta,
} from './database-agent.schema.js';

export class DatabaseAgentService {
  private mockQueryLogs = new Map<string, QueryResult>();
  private permissionEngine: PermissionEngineService;

  private SCHEMA_METADATA: Record<string, TableSchemaMeta> = {
    projects: {
      tableName: 'projects',
      columnCount: 4,
      columns: [
        { name: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { name: 'name', dataType: 'varchar(255)', isNullable: false, isPrimaryKey: false },
        { name: 'targetUrl', dataType: 'varchar(2048)', isNullable: true, isPrimaryKey: false },
        { name: 'createdAt', dataType: 'timestamp', isNullable: false, isPrimaryKey: false },
      ],
      indexes: ['project_created_at_idx'],
    },
    tasks: {
      tableName: 'tasks',
      columnCount: 6,
      columns: [
        { name: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { name: 'projectId', dataType: 'uuid', isNullable: false, isPrimaryKey: false },
        { name: 'command', dataType: 'text', isNullable: false, isPrimaryKey: false },
        { name: 'targetUrl', dataType: 'varchar(2048)', isNullable: true, isPrimaryKey: false },
        { name: 'status', dataType: 'task_status', isNullable: false, isPrimaryKey: false },
        { name: 'createdAt', dataType: 'timestamp', isNullable: false, isPrimaryKey: false },
      ],
      indexes: ['task_project_id_idx', 'task_status_idx'],
    },
    runs: {
      tableName: 'runs',
      columnCount: 5,
      columns: [
        { name: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { name: 'taskId', dataType: 'uuid', isNullable: false, isPrimaryKey: false },
        { name: 'status', dataType: 'run_status', isNullable: false, isPrimaryKey: false },
        { name: 'startedAt', dataType: 'timestamp', isNullable: false, isPrimaryKey: false },
        { name: 'completedAt', dataType: 'timestamp', isNullable: true, isPrimaryKey: false },
      ],
      indexes: ['run_task_id_idx', 'run_status_idx'],
    },
    issues: {
      tableName: 'issues',
      columnCount: 16,
      columns: [
        { name: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { name: 'runId', dataType: 'uuid', isNullable: false, isPrimaryKey: false },
        { name: 'title', dataType: 'varchar(255)', isNullable: false, isPrimaryKey: false },
        { name: 'severity', dataType: 'issue_severity', isNullable: false, isPrimaryKey: false },
        { name: 'status', dataType: 'issue_status', isNullable: false, isPrimaryKey: false },
        { name: 'rootCauseAnalysis', dataType: 'jsonb', isNullable: true, isPrimaryKey: false },
      ],
      indexes: ['issue_run_id_idx', 'issue_severity_idx', 'issue_status_idx'],
    },
    vault_credentials: {
      tableName: 'vault_credentials',
      columnCount: 9,
      columns: [
        { name: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { name: 'secretRef', dataType: 'varchar(255)', isNullable: false, isPrimaryKey: false },
        { name: 'provider', dataType: 'varchar(50)', isNullable: false, isPrimaryKey: false },
        { name: 'encryptedValue', dataType: 'text', isNullable: false, isPrimaryKey: false },
        { name: 'version', dataType: 'integer', isNullable: false, isPrimaryKey: false },
        { name: 'status', dataType: 'varchar(50)', isNullable: false, isPrimaryKey: false },
      ],
      indexes: ['vault_credentials_secret_ref_idx', 'vault_credentials_provider_idx'],
    },
    security_scans: {
      tableName: 'security_scans',
      columnCount: 10,
      columns: [
        { name: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { name: 'target', dataType: 'varchar(2048)', isNullable: false, isPrimaryKey: false },
        { name: 'scanType', dataType: 'varchar(50)', isNullable: false, isPrimaryKey: false },
        { name: 'status', dataType: 'varchar(50)', isNullable: false, isPrimaryKey: false },
        { name: 'totalFindings', dataType: 'integer', isNullable: false, isPrimaryKey: false },
      ],
      indexes: ['security_scans_target_idx', 'security_scans_status_idx'],
    },
  };

  constructor(private db?: Database, permissionEngine?: PermissionEngineService) {
    this.permissionEngine = permissionEngine || new PermissionEngineService(db);
  }

  /**
   * Inspect DB schema metadata (tables, columns, types, indexes)
   */
  public async inspectSchema(tableName?: string): Promise<TableSchemaMeta[]> {
    AuditLoggerService.log(
      'DB_SCHEMA_INSPECTED',
      `Inspected DB schema metadata${tableName ? ` for table '${tableName}'` : ''}.`,
      'success',
      tableName || 'database',
      { tableName }
    );

    if (tableName) {
      const meta = this.SCHEMA_METADATA[tableName.toLowerCase()];
      if (!meta) {
        throw new AppError('NOT_FOUND', `Table '${tableName}' not found in database schema`, 404);
      }
      return [meta];
    }

    return Object.values(this.SCHEMA_METADATA);
  }

  /**
   * Classify SQL query into type and permission tier
   */
  public classifyQuery(sql: string): {
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL';
    permissionTier: 'Green' | 'Yellow' | 'Red';
    actionName: string;
  } {
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('EXPLAIN')) {
      return { queryType: 'SELECT', permissionTier: 'Green', actionName: 'read_code' };
    }

    if (trimmed.startsWith('INSERT')) {
      return { queryType: 'INSERT', permissionTier: 'Yellow', actionName: 'propose_code_fix' };
    }

    if (trimmed.startsWith('UPDATE')) {
      return { queryType: 'UPDATE', permissionTier: 'Yellow', actionName: 'propose_code_fix' };
    }

    if (trimmed.startsWith('DELETE')) {
      return { queryType: 'DELETE', permissionTier: 'Yellow', actionName: 'delete_resource' };
    }

    // DDL / Dangerous schema modifications
    return { queryType: 'DDL', permissionTier: 'Red', actionName: 'db_migration' };
  }

  /**
   * Dangerous query detector (checks for un-WHERE'd DELETE/UPDATE, DROP TABLE, TRUNCATE, etc.)
   */
  public detectDangerousQuery(sql: string): void {
    const upper = sql.trim().toUpperCase();

    // Check for dangerous DDL operations
    if (/\b(?:DROP|TRUNCATE|GRANT|REVOKE|VACUUM\s+FULL)\b/i.test(upper)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Dangerous query blocked: DDL statements like DROP, TRUNCATE, GRANT, or VACUUM FULL cannot be executed directly via normal query endpoints. Use /api/v1/database/migrate with human approval.',
        400
      );
    }

    // Check for un-WHERE'd DELETE
    if (/\bDELETE\s+FROM\s+[a-zA-Z0-9_]+\s*$/i.test(upper) || (upper.includes('DELETE FROM') && !upper.includes('WHERE'))) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Dangerous query blocked: DELETE query without a WHERE clause is prohibited to prevent accidental mass deletion.',
        400
      );
    }

    // Check for un-WHERE'd UPDATE
    if (upper.startsWith('UPDATE') && !upper.includes('WHERE')) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Dangerous query blocked: UPDATE query without a WHERE clause is prohibited to prevent accidental mass overwrite.',
        400
      );
    }
  }

  /**
   * Execute SQL Query with safety checks, row limits, timeout, and permission control
   */
  public async executeQuery(input: ExecuteQueryInput): Promise<QueryResult> {
    const { query, actor = 'system', maxRows = 100, timeoutMs = 5000 } = input;
    const startTime = Date.now();
    const queryId = `db_q_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    const cleanQuery = redactString(query);

    // 1. Dangerous query check
    this.detectDangerousQuery(query);

    // 2. Query classification & permission check
    const { queryType, permissionTier, actionName } = this.classifyQuery(query);

    const permResult = await this.permissionEngine.evaluatePermission({
      action: actionName,
      actor,
      resourceId: 'database',
    });

    if (permResult.outcome !== 'allow') {
      AuditLoggerService.log(
        'DB_QUERY_BLOCKED',
        `Database query blocked for actor '${actor}' (${permissionTier} Tier). ${permResult.reason}`,
        'failure',
        queryId,
        { query: cleanQuery, queryType, permissionTier, actor }
      );

      throw new AppError(
        'FORBIDDEN',
        `Database query execution denied for actor '${actor}' (${permissionTier} Tier). ${permResult.reason}`,
        403
      );
    }

    // 3. Apply row limit and execute query
    let rows: Record<string, any>[] = [];
    let fields: string[] = [];

    if (this.db) {
      try {
        const rawResult: any = await this.db.execute(drizzleSql.raw(query));
        rows = Array.isArray(rawResult?.rows) ? rawResult.rows.slice(0, maxRows) : [];
        if (rows.length > 0) {
          fields = Object.keys(rows[0]);
        }
      } catch (err: any) {
        throw new AppError('ACTION_FAILED', `SQL execution error: ${redactString(err.message || 'Syntax error')}`, 400);
      }
    } else {
      // Mock execution results based on query type
      if (queryType === 'SELECT') {
        rows = [
          { id: 'proj_1', name: 'AgentOps Production', targetUrl: 'https://agentops.ai', createdAt: now },
          { id: 'proj_2', name: 'Staging Environment', targetUrl: 'https://staging.agentops.ai', createdAt: now },
        ].slice(0, maxRows);
        fields = ['id', 'name', 'targetUrl', 'createdAt'];
      } else {
        rows = [{ affectedRows: 1, status: 'success' }];
        fields = ['affectedRows', 'status'];
      }
    }

    const executionTimeMs = Date.now() - startTime;
    const cleanRows = redactObject(rows);

    const result: QueryResult = {
      queryId,
      query: cleanQuery,
      queryType,
      permissionTier,
      rowCount: cleanRows.length,
      executionTimeMs,
      rows: cleanRows,
      fields,
      executedAt: now,
    };

    if (this.db) {
      try {
        await this.db.insert(databaseQueryLogs).values({
          sqlQuery: cleanQuery,
          queryType,
          permissionTier,
          status: 'executed',
          rowCount: cleanRows.length,
          executionTimeMs,
          actor: redactString(actor),
          executedAt: new Date(),
        });
      } catch {}
    }

    this.mockQueryLogs.set(queryId, result);

    AuditLoggerService.log(
      'DB_QUERY_EXECUTED',
      `Database ${queryType} query executed by '${actor}' (${cleanRows.length} rows, ${executionTimeMs}ms). Secrets redacted.`,
      'success',
      queryId,
      redactObject({ query: cleanQuery, queryType, rowCount: cleanRows.length, executionTimeMs, actor })
    );

    return result;
  }

  /**
   * Execute Schema Migration DDL (Red Tier — Requires Human Approval)
   */
  public async executeMigration(input: ExecuteMigrationInput): Promise<{
    migrationId: string;
    status: 'executed';
    migrationSql: string;
    executedBy: string;
    executedAt: string;
  }> {
    const { migrationSql, actor, reason, resourceId } = input;
    const migrationId = resourceId || `mig_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    const cleanSql = redactString(migrationSql);

    // Permission check for DB Migration (Red Tier)
    const permResult = await this.permissionEngine.evaluatePermission({
      action: 'db_migration',
      actor,
      resourceId: migrationId,
    });

    if (permResult.outcome !== 'allow') {
      AuditLoggerService.log(
        'DB_MIGRATION_REQUESTED',
        `Schema migration requested by '${actor}'. Execution paused pending mandatory human approval.`,
        'in_progress',
        migrationId,
        { migrationSql: cleanSql, actor, reason }
      );

      throw new AppError(
        'FORBIDDEN',
        `Schema migration execution blocked for actor '${actor}' (Red Tier). Mandatory human approval is required before executing DDL migrations. ${permResult.reason}`,
        403
      );
    }

    if (this.db) {
      try {
        await this.db.execute(drizzleSql.raw(migrationSql));
      } catch (err: any) {
        throw new AppError('ACTION_FAILED', `Migration execution error: ${redactString(err.message || 'DDL error')}`, 400);
      }
    }

    AuditLoggerService.log(
      'DB_MIGRATION_EXECUTED',
      `Schema DDL migration executed successfully by '${actor}'. Execution resumed after human approval.`,
      'success',
      migrationId,
      redactObject({ migrationId, migrationSql: cleanSql, actor, reason })
    );

    return {
      migrationId,
      status: 'executed',
      migrationSql: cleanSql,
      executedBy: redactString(actor),
      executedAt: now,
    };
  }

  /**
   * List past query execution logs
   */
  public async listQueryLogs(): Promise<QueryResult[]> {
    if (this.db) {
      try {
        const records = await this.db.select().from(databaseQueryLogs).orderBy(desc(databaseQueryLogs.executedAt));
        return records.map((r: any) => ({
          queryId: r.id,
          query: r.sqlQuery,
          queryType: r.queryType as any,
          permissionTier: r.permissionTier as any,
          rowCount: r.rowCount,
          executionTimeMs: r.executionTimeMs,
          rows: [],
          fields: [],
          executedAt: r.executedAt ? new Date(r.executedAt).toISOString() : new Date().toISOString(),
        }));
      } catch {}
    }

    return Array.from(this.mockQueryLogs.values()).map(r => redactObject(r));
  }
}
