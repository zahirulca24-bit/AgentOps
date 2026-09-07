import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseAgentService } from '../../src/modules/database/database-agent.service.js';
import { PermissionEngineService } from '../../src/modules/permission/permission.service.js';
import { HumanApprovalService } from '../../src/modules/approval/approval.service.js';
import { AuditLoggerService } from '../../src/modules/audit/audit.service.js';

describe('Phase 3.10 — Database Agent (Unit Tests)', () => {
  let dbAgent: DatabaseAgentService;
  let approvalService: HumanApprovalService;
  let permissionEngine: PermissionEngineService;

  beforeEach(() => {
    AuditLoggerService.clearLogs();
    approvalService = new HumanApprovalService();
    permissionEngine = new PermissionEngineService(undefined, approvalService);
    dbAgent = new DatabaseAgentService(undefined, permissionEngine);
  });

  describe('Schema Inspection & Metadata', () => {
    it('inspects database schema tables, column data types, primary keys, and index metadata', async () => {
      const tables = await dbAgent.inspectSchema();
      expect(tables.length).toBeGreaterThan(0);

      const projectsTable = tables.find(t => t.tableName === 'projects');
      expect(projectsTable).toBeDefined();
      expect(projectsTable?.columns.some(c => c.isPrimaryKey)).toBe(true);

      const specificTable = await dbAgent.inspectSchema('issues');
      expect(specificTable[0].tableName).toBe('issues');
      expect(specificTable[0].indexes).toContain('issue_severity_idx');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'DB_SCHEMA_INSPECTED' });
      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Query Classification & Dangerous Query Detection', () => {
    it('classifies SELECT as Green, INSERT/UPDATE as Yellow, and DDL as Red tier', () => {
      expect(dbAgent.classifyQuery('SELECT * FROM projects').permissionTier).toBe('Green');
      expect(dbAgent.classifyQuery('INSERT INTO tasks (command) VALUES (\'test\')').permissionTier).toBe('Yellow');
      expect(dbAgent.classifyQuery('UPDATE tasks SET status = \'completed\' WHERE id = 1').permissionTier).toBe('Yellow');
      expect(dbAgent.classifyQuery('ALTER TABLE projects ADD COLUMN description text').permissionTier).toBe('Red');
    });

    it('blocks dangerous DELETE or UPDATE queries missing a WHERE clause', () => {
      expect(() => dbAgent.detectDangerousQuery('DELETE FROM projects')).toThrow(/WHERE clause/);
      expect(() => dbAgent.detectDangerousQuery('UPDATE tasks SET status = \'failed\'')).toThrow(/WHERE clause/);
    });

    it('blocks DDL statements like DROP TABLE or TRUNCATE from query execution endpoint', () => {
      expect(() => dbAgent.detectDangerousQuery('DROP TABLE projects')).toThrow(/DDL statements/);
      expect(() => dbAgent.detectDangerousQuery('TRUNCATE TABLE runs')).toThrow(/DDL statements/);
    });
  });

  describe('Query Execution, Limits, and Secret Redaction', () => {
    it('executes safe SELECT query, applies maxRows limit, and redacts secrets in result output', async () => {
      const result = await dbAgent.executeQuery({
        query: 'SELECT * FROM projects WHERE name = \'ghp_1234567890abcdef1234567890abcdef123456\'',
        actor: 'developer',
        maxRows: 1,
      });

      expect(result.queryType).toBe('SELECT');
      expect(result.permissionTier).toBe('Green');
      expect(result.rowCount).toBeLessThanOrEqual(1);
      expect(result.query).not.toContain('ghp_1234567890abcdef');
      expect(result.query).toContain('[REDACTED_GITHUB_TOKEN]');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'DB_QUERY_EXECUTED' });
      expect(auditLogs.length).toBe(1);
    });
  });

  describe('Schema Migration & Human Approval Control', () => {
    it('blocks DDL schema migration when human approval is missing (Red Tier)', async () => {
      await expect(
        dbAgent.executeMigration({
          migrationSql: 'ALTER TABLE projects ADD COLUMN description text',
          actor: 'dev_user',
          reason: 'Add feature description',
        })
      ).rejects.toThrow(/Red Tier|approval/i);
    });

    it('executes DDL schema migration when explicit human approval is granted in approval system', async () => {
      const req = await approvalService.createApprovalRequest({
        actionCategory: 'DATABASE_MIGRATION',
        actionSummary: 'Schema Migration ALTER TABLE',
        requestedBy: 'dba_admin',
        resourceId: 'mig_001',
      });
      await approvalService.approveRequest(req.approvalId, 'lead_db_architect');

      // Now evaluate migration with approved resourceId
      const migrationRes = await dbAgent.executeMigration({
        migrationSql: 'ALTER TABLE projects ADD COLUMN description text',
        actor: 'dba_admin',
        resourceId: 'mig_001',
        reason: 'Migration approved by lead DBA',
      });

      expect(migrationRes.status).toBe('executed');
      expect(migrationRes.executedBy).toBe('dba_admin');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'DB_MIGRATION_EXECUTED' });
      expect(auditLogs.length).toBe(1);
    });
  });
});
