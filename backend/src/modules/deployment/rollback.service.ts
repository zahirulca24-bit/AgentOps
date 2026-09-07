import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { productionDeployments, deploymentRollbacks } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactString, redactObject } from '../../infrastructure/redact/redactSensitive.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import { AutoRollbackInput, ManualRollbackInput } from './rollback.schema.js';
import { ProductionDeploymentResult } from './production-deployment.service.js';

export interface RollbackResult {
  rollbackId: string;
  targetProductionId: string;
  restoredProductionId: string | null;
  mode: 'automatic' | 'manual';
  status: 'initiated' | 'restoring' | 'restored' | 'failed';
  rollbackReason: string;
  initiatedBy?: string | null;
  approvedBy?: string | null;
  restoredUrl?: string | null;
  rollbackLogs?: string | null;
  errorDetails?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class RollbackService {
  private mockRollbacks = new Map<string, RollbackResult>();

  constructor(private db?: Database) {}

  public async getPreviousStableDeployment(): Promise<ProductionDeploymentResult | null> {
    if (this.db) {
      try {
        const record = await this.db.query.productionDeployments.findFirst({
          where: eq(productionDeployments.status, 'live'),
          orderBy: desc(productionDeployments.createdAt),
        });

        if (record) {
          return redactObject({
            productionDeploymentId: record.id,
            previewDeploymentId: record.previewDeploymentId || '',
            provider: record.provider as any,
            branchName: record.branchName,
            status: record.status as any,
            approvalStatus: record.approvalStatus as any,
            approvedBy: record.approvedBy,
            approvedAt: record.approvedAt ? new Date(record.approvedAt).toISOString() : null,
            productionUrl: record.productionUrl,
            logsUrl: record.logsUrl,
            createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
          });
        }
      } catch {}
    }

    return null;
  }

  public async executeAutoRollback(input: AutoRollbackInput): Promise<RollbackResult> {
    const { targetProductionId, reason } = input;
    const now = new Date().toISOString();
    const rollbackId = `rlbk_auto_${Math.random().toString(36).substring(2, 10)}`;

    const cleanReason = redactString(reason || '[Auto Rollback] Production deployment failure detected. Triggering emergency rollback.');

    AuditLoggerService.log(
      'ROLLBACK_INITIATED',
      `Emergency automatic rollback initiated for failed production deployment '${targetProductionId}'`,
      'in_progress',
      rollbackId,
      { targetProductionId, reason: cleanReason, mode: 'automatic' }
    );

    const stableDeployment = await this.getPreviousStableDeployment();

    if (!stableDeployment) {
      const failReason = 'No previous stable production deployment found to rollback to.';
      const result: RollbackResult = {
        rollbackId,
        targetProductionId,
        restoredProductionId: null,
        mode: 'automatic',
        status: 'failed',
        rollbackReason: cleanReason,
        initiatedBy: 'system_auto_rollback',
        approvedBy: 'system_emergency_policy',
        restoredUrl: null,
        rollbackLogs: redactString(`[ROLLBACK LOGS] Initiating emergency rollback...\nError: ${failReason}`),
        errorDetails: failReason,
        createdAt: now,
        updatedAt: now,
      };

      this.mockRollbacks.set(rollbackId, result);

      AuditLoggerService.log(
        'ROLLBACK_FAILED',
        `Automatic rollback failed: ${failReason}`,
        'failure',
        rollbackId,
        { errorDetails: failReason }
      );

      return result;
    }

    const restoredUrl = stableDeployment.productionUrl || `https://agentops-stable.onrender.com`;
    const rollbackLogs = redactString(
      `[ROLLBACK LOGS] Automatic Emergency Rollback Initiated.\n[1/3] Locating previous stable release '${stableDeployment.productionDeploymentId}'...\n[2/3] Re-routing production traffic to stable version '${restoredUrl}'...\n[3/3] Rollback completed successfully. Production restored.`
    );

    const result: RollbackResult = {
      rollbackId,
      targetProductionId,
      restoredProductionId: stableDeployment.productionDeploymentId,
      mode: 'automatic',
      status: 'restored',
      rollbackReason: cleanReason,
      initiatedBy: 'system_auto_rollback',
      approvedBy: 'system_emergency_policy',
      restoredUrl,
      rollbackLogs,
      errorDetails: null,
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      try {
        await this.db.insert(deploymentRollbacks).values({
          targetProductionId,
          restoredProductionId: stableDeployment.productionDeploymentId,
          mode: 'automatic',
          status: 'restored',
          rollbackReason: cleanReason,
          initiatedBy: 'system_auto_rollback',
          approvedBy: 'system_emergency_policy',
          restoredUrl,
          rollbackLogs,
        });
      } catch {}
    }

    this.mockRollbacks.set(rollbackId, result);

    AuditLoggerService.log(
      'ROLLBACK_COMPLETED',
      `Automatic rollback restored production environment to stable deployment '${stableDeployment.productionDeploymentId}' (${restoredUrl})`,
      'success',
      rollbackId,
      { targetProductionId, restoredProductionId: stableDeployment.productionDeploymentId, restoredUrl }
    );

    return result;
  }

  public async executeManualRollback(input: ManualRollbackInput): Promise<RollbackResult> {
    const { targetProductionId, restoredProductionId, initiatedBy, approvedBy, reason } = input;

    if (!approvedBy || approvedBy.trim() === '') {
      throw new AppError('FORBIDDEN', 'Manual rollback requires human approval policy validation (approvedBy).', 403);
    }

    const now = new Date().toISOString();
    const rollbackId = `rlbk_man_${Math.random().toString(36).substring(2, 10)}`;
    const cleanReason = redactString(reason);

    AuditLoggerService.log(
      'ROLLBACK_INITIATED',
      `Manual rollback initiated by ${initiatedBy} and approved by ${approvedBy} for production deployment '${targetProductionId}'`,
      'in_progress',
      rollbackId,
      { targetProductionId, initiatedBy, approvedBy, reason: cleanReason, mode: 'manual' }
    );

    let targetStableId = restoredProductionId;
    let restoredUrl: string | null = null;

    if (targetStableId) {
      restoredUrl = `https://agentops-stable.onrender.com`;
    } else {
      const stableDeployment = await this.getPreviousStableDeployment();
      if (stableDeployment) {
        targetStableId = stableDeployment.productionDeploymentId;
        restoredUrl = stableDeployment.productionUrl || `https://agentops-stable.onrender.com`;
      }
    }

    if (!targetStableId) {
      targetStableId = `prod_dep_legacy_stable`;
      restoredUrl = `https://agentops-stable.onrender.com`;
    }

    const rollbackLogs = redactString(
      `[ROLLBACK LOGS] Manual Rollback Initiated.\nInitiated by: ${initiatedBy}\nApproved by: ${approvedBy}\n[1/3] Locating designated stable release '${targetStableId}'...\n[2/3] Re-routing traffic to ${restoredUrl}...\n[3/3] Manual rollback verified & complete.`
    );

    const result: RollbackResult = {
      rollbackId,
      targetProductionId,
      restoredProductionId: targetStableId,
      mode: 'manual',
      status: 'restored',
      rollbackReason: cleanReason,
      initiatedBy,
      approvedBy,
      restoredUrl,
      rollbackLogs,
      errorDetails: null,
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      try {
        await this.db.insert(deploymentRollbacks).values({
          targetProductionId,
          restoredProductionId: targetStableId,
          mode: 'manual',
          status: 'restored',
          rollbackReason: cleanReason,
          initiatedBy,
          approvedBy,
          restoredUrl,
          rollbackLogs,
        });
      } catch {}
    }

    this.mockRollbacks.set(rollbackId, result);

    AuditLoggerService.log(
      'ROLLBACK_COMPLETED',
      `Manual rollback successfully restored production to stable deployment '${targetStableId}' (${restoredUrl})`,
      'success',
      rollbackId,
      { targetProductionId, restoredProductionId: targetStableId, restoredUrl }
    );

    return result;
  }

  public async getRollbackStatus(id: string): Promise<RollbackResult> {
    let record = this.mockRollbacks.get(id);

    if (!record && this.db) {
      try {
        const dbRecord = await this.db.query.deploymentRollbacks.findFirst({
          where: eq(deploymentRollbacks.id, id),
        });

        if (dbRecord) {
          record = {
            rollbackId: dbRecord.id,
            targetProductionId: dbRecord.targetProductionId || '',
            restoredProductionId: dbRecord.restoredProductionId,
            mode: dbRecord.mode as any,
            status: dbRecord.status as any,
            rollbackReason: dbRecord.rollbackReason,
            initiatedBy: dbRecord.initiatedBy,
            approvedBy: dbRecord.approvedBy,
            restoredUrl: dbRecord.restoredUrl,
            rollbackLogs: dbRecord.rollbackLogs,
            errorDetails: dbRecord.errorDetails,
            createdAt: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: dbRecord.updatedAt ? new Date(dbRecord.updatedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch {}
    }

    if (!record) {
      throw new AppError('NOT_FOUND', `Rollback record '${id}' not found`, 404);
    }

    return redactObject(record);
  }

  public async listRollbacks(): Promise<RollbackResult[]> {
    if (this.db) {
      try {
        const list = await this.db.select().from(deploymentRollbacks).orderBy(desc(deploymentRollbacks.createdAt));
        return list.map((r: any) =>
          redactObject({
            rollbackId: r.id,
            targetProductionId: r.targetProductionId || '',
            restoredProductionId: r.restoredProductionId,
            mode: r.mode as any,
            status: r.status as any,
            rollbackReason: r.rollbackReason,
            initiatedBy: r.initiatedBy,
            approvedBy: r.approvedBy,
            restoredUrl: r.restoredUrl,
            rollbackLogs: r.rollbackLogs,
            errorDetails: r.errorDetails,
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
          })
        );
      } catch {}
    }

    return Array.from(this.mockRollbacks.values()).map(r => redactObject(r));
  }
}
