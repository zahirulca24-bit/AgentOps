import { redactObject } from '../../infrastructure/redact/redactSensitive.js';

export type AuditEventType =
  | 'FINDING_CREATED'
  | 'SEVERITY_CLASSIFIED'
  | 'ROOT_CAUSE_ANALYZED'
  | 'TASK_BRANCH_CREATED'
  | 'FIX_PROPOSED'
  | 'TESTS_EXECUTED'
  | 'CHANGES_COMMITTED'
  | 'PR_CREATED'
  | 'CI_CHECK_INSPECTED'
  | 'SELF_FIX_ATTEMPT_STARTED'
  | 'SELF_FIX_ATTEMPT_PASSED'
  | 'SELF_FIX_ATTEMPT_FAILED'
  | 'SELF_FIX_ATTEMPT_DUPLICATE'
  | 'SELF_FIX_COMPLETED'
  | 'SELF_FIX_ESCALATED'
  | 'PRODUCTION_DEPLOYMENT_REQUESTED'
  | 'PRODUCTION_DEPLOYMENT_APPROVED'
  | 'PRODUCTION_DEPLOYMENT_REJECTED'
  | 'PRODUCTION_DEPLOYMENT_EXECUTED'
  | 'PRODUCTION_DEPLOYMENT_FAILED'
  | 'ROLLBACK_INITIATED'
  | 'ROLLBACK_COMPLETED'
  | 'ROLLBACK_FAILED'
  | 'HUMAN_APPROVAL_REQUESTED'
  | 'HUMAN_APPROVAL_GRANTED'
  | 'HUMAN_APPROVAL_REJECTED'
  | 'PERMISSION_EVALUATED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_DENIED'
  | 'SECRET_STORED'
  | 'SECRET_ACCESSED'
  | 'SECRET_ROTATED'
  | 'SECRET_REVOKED'
  | 'SECURITY_SCAN_STARTED'
  | 'SECURITY_SCAN_COMPLETED'
  | 'SECURITY_FINDINGS_REPORTED'
  | 'DB_SCHEMA_INSPECTED'
  | 'DB_QUERY_EXECUTED'
  | 'DB_QUERY_BLOCKED'
  | 'DB_MIGRATION_REQUESTED'
  | 'DB_MIGRATION_EXECUTED';

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  resourceId?: string;
  action: string;
  status: 'success' | 'failure' | 'in_progress' | 'skipped';
  timestamp: string;
  metadata?: Record<string, any>;
}

export class AuditLoggerService {
  private static logs: AuditLogEntry[] = [];

  public static log(
    eventType: AuditEventType,
    action: string,
    status: 'success' | 'failure' | 'in_progress' | 'skipped',
    resourceId?: string,
    metadata?: Record<string, any>
  ): AuditLogEntry {
    const entry: AuditLogEntry = redactObject({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      resourceId,
      action,
      status,
      timestamp: new Date().toISOString(),
      metadata,
    });

    AuditLoggerService.logs.push(entry);
    return entry;
  }

  public static getLogs(filter?: { eventType?: AuditEventType; resourceId?: string }): AuditLogEntry[] {
    let result = [...AuditLoggerService.logs];
    if (filter?.eventType) {
      result = result.filter(l => l.eventType === filter.eventType);
    }
    if (filter?.resourceId) {
      result = result.filter(l => l.resourceId === filter.resourceId);
    }
    return result;
  }

  public static clearLogs(): void {
    AuditLoggerService.logs = [];
  }
}
