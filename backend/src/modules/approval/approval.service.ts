import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { approvalRequests } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactString, redactObject } from '../../infrastructure/redact/redactSensitive.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import {
  CreateApprovalRequestInput,
  DecideApprovalInput,
  CriticalActionCategory,
  ApprovalStatus,
} from './approval.schema.js';

export interface ApprovalRequestResult {
  approvalId: string;
  actionCategory: CriticalActionCategory;
  status: ApprovalStatus;
  resourceId?: string | null;
  actionSummary: string;
  requestedBy: string;
  approvedBy?: string | null;
  reason?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class HumanApprovalService {
  private mockApprovals = new Map<string, ApprovalRequestResult>();

  constructor(private db?: Database) {}

  public async createApprovalRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequestResult> {
    const { actionCategory, actionSummary, requestedBy, resourceId, reason } = input;
    const now = new Date().toISOString();
    const approvalId = `appr_req_${Math.random().toString(36).substring(2, 10)}`;

    const cleanSummary = redactString(actionSummary);
    const cleanReason = reason ? redactString(reason) : null;

    const result: ApprovalRequestResult = {
      approvalId,
      actionCategory,
      status: 'pending',
      resourceId: resourceId || null,
      actionSummary: cleanSummary,
      requestedBy,
      approvedBy: null,
      reason: cleanReason,
      requestedAt: now,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      try {
        await this.db.insert(approvalRequests).values({
          actionCategory,
          status: 'pending',
          resourceId: resourceId || null,
          actionSummary: cleanSummary,
          requestedBy,
          reason: cleanReason,
          requestedAt: new Date(),
        });
      } catch {}
    }

    this.mockApprovals.set(approvalId, result);

    AuditLoggerService.log(
      'HUMAN_APPROVAL_REQUESTED',
      `Approval requested for critical action '${actionCategory}' on resource '${resourceId || 'N/A'}' by ${requestedBy}. Execution paused pending human approval.`,
      'in_progress',
      approvalId,
      { actionCategory, resourceId, requestedBy, actionSummary: cleanSummary }
    );

    return result;
  }

  public async approveRequest(id: string, actor: string, reason?: string): Promise<ApprovalRequestResult> {
    const record = await this.getApprovalRequest(id);

    if (record.status !== 'pending') {
      throw new AppError('CONFLICT', `Approval request '${id}' is already in state '${record.status}'`, 409);
    }

    const now = new Date().toISOString();
    const cleanReason = reason ? redactString(reason) : record.reason;

    record.status = 'approved';
    record.approvedBy = actor;
    record.reason = cleanReason;
    record.decidedAt = now;
    record.updatedAt = now;

    if (this.db) {
      try {
        await this.db
          .update(approvalRequests)
          .set({
            status: 'approved',
            approvedBy: actor,
            reason: cleanReason,
            decidedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(approvalRequests.id, id));
      } catch {}
    }

    this.mockApprovals.set(id, record);

    AuditLoggerService.log(
      'HUMAN_APPROVAL_GRANTED',
      `Critical action '${record.actionCategory}' approved by ${actor}. Execution resumed.`,
      'success',
      id,
      { actionCategory: record.actionCategory, resourceId: record.resourceId, approvedBy: actor, decidedAt: now }
    );

    return record;
  }

  public async rejectRequest(id: string, actor: string, reason?: string): Promise<ApprovalRequestResult> {
    const record = await this.getApprovalRequest(id);

    if (record.status !== 'pending') {
      throw new AppError('CONFLICT', `Approval request '${id}' is already in state '${record.status}'`, 409);
    }

    const now = new Date().toISOString();
    const cleanReason = redactString(reason || 'Rejected by human approver');

    record.status = 'rejected';
    record.approvedBy = actor;
    record.reason = cleanReason;
    record.decidedAt = now;
    record.updatedAt = now;

    if (this.db) {
      try {
        await this.db
          .update(approvalRequests)
          .set({
            status: 'rejected',
            approvedBy: actor,
            reason: cleanReason,
            decidedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(approvalRequests.id, id));
      } catch {}
    }

    this.mockApprovals.set(id, record);

    AuditLoggerService.log(
      'HUMAN_APPROVAL_REJECTED',
      `Critical action '${record.actionCategory}' rejected by ${actor}. Execution remains blocked.`,
      'skipped',
      id,
      { actionCategory: record.actionCategory, resourceId: record.resourceId, rejectedBy: actor, reason: cleanReason }
    );

    return record;
  }

  public async verifyApproval(actionCategory: CriticalActionCategory, resourceId?: string): Promise<boolean> {
    const pending = Array.from(this.mockApprovals.values()).find(
      r => r.actionCategory === actionCategory && (!resourceId || r.resourceId === resourceId) && r.status === 'approved'
    );

    if (pending) return true;

    if (this.db) {
      try {
        const dbRecord = await this.db.query.approvalRequests.findFirst({
          where: eq(approvalRequests.actionCategory, actionCategory),
          orderBy: desc(approvalRequests.createdAt),
        });
        if (dbRecord && dbRecord.status === 'approved') return true;
      } catch {}
    }

    throw new AppError(
      'FORBIDDEN',
      `Execution blocked: Critical action '${actionCategory}' requires an approved human approval request before proceeding.`,
      403
    );
  }

  public async getApprovalRequest(id: string): Promise<ApprovalRequestResult> {
    let record = this.mockApprovals.get(id);

    if (!record && this.db) {
      try {
        const dbRecord = await this.db.query.approvalRequests.findFirst({
          where: eq(approvalRequests.id, id),
        });
        if (dbRecord) {
          record = {
            approvalId: dbRecord.id,
            actionCategory: dbRecord.actionCategory as CriticalActionCategory,
            status: dbRecord.status as ApprovalStatus,
            resourceId: dbRecord.resourceId,
            actionSummary: dbRecord.actionSummary,
            requestedBy: dbRecord.requestedBy,
            approvedBy: dbRecord.approvedBy,
            reason: dbRecord.reason,
            requestedAt: dbRecord.requestedAt ? new Date(dbRecord.requestedAt).toISOString() : new Date().toISOString(),
            decidedAt: dbRecord.decidedAt ? new Date(dbRecord.decidedAt).toISOString() : null,
            createdAt: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: dbRecord.updatedAt ? new Date(dbRecord.updatedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch {}
    }

    if (!record) {
      throw new AppError('NOT_FOUND', `Approval request '${id}' not found`, 404);
    }

    return redactObject(record);
  }

  public async listApprovalRequests(filter?: { status?: ApprovalStatus; category?: CriticalActionCategory }): Promise<ApprovalRequestResult[]> {
    let list: ApprovalRequestResult[] = [];

    if (this.db) {
      try {
        const records = await this.db.select().from(approvalRequests).orderBy(desc(approvalRequests.createdAt));
        list = records.map((r: any) => ({
          approvalId: r.id,
          actionCategory: r.actionCategory as CriticalActionCategory,
          status: r.status as ApprovalStatus,
          resourceId: r.resourceId,
          actionSummary: r.actionSummary,
          requestedBy: r.requestedBy,
          approvedBy: r.approvedBy,
          reason: r.reason,
          requestedAt: r.requestedAt ? new Date(r.requestedAt).toISOString() : new Date().toISOString(),
          decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
        }));
      } catch {
        list = Array.from(this.mockApprovals.values());
      }
    } else {
      list = Array.from(this.mockApprovals.values());
    }

    if (filter?.status) {
      list = list.filter(r => r.status === filter.status);
    }
    if (filter?.category) {
      list = list.filter(r => r.actionCategory === filter.category);
    }

    return list.map(r => redactObject(r));
  }
}
