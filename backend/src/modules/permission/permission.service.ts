import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { permissionDecisions } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactString, redactObject } from '../../infrastructure/redact/redactSensitive.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import { HumanApprovalService } from '../approval/approval.service.js';
import {
  EvaluatePermissionInput,
  PermissionTier,
  PermissionDecisionOutcome,
} from './permission.schema.js';

export interface PermissionEvaluationResult {
  decisionId: string;
  action: string;
  tier: PermissionTier;
  outcome: PermissionDecisionOutcome;
  actor: string;
  resourceId?: string | null;
  reason: string;
  evaluatedAt: string;
}

export class PermissionEngineService {
  private approvalService: HumanApprovalService;
  private mockDecisions = new Map<string, PermissionEvaluationResult>();

  private GREEN_ACTIONS = new Set([
    'read_logs',
    'view_report',
    'list_runs',
    'get_status',
    'read_code',
    'list_projects',
    'get_health',
    'view_audit_logs',
    'get_deployment_status',
    'list_deployments',
  ]);

  private YELLOW_ACTIONS = new Set([
    'create_preview_deployment',
    'create_browser_worker',
    'trigger_qa_run',
    'propose_code_fix',
    'run_unit_tests',
    'create_task_branch',
    'generate_test_cases',
    'analyze_logs',
  ]);

  private RED_ACTIONS = new Set([
    'deploy_production',
    'db_migration',
    'delete_resource',
    'access_secrets',
    'rotate_credentials',
    'manual_rollback',
    'drop_database',
    'delete_storage_bucket',
    'purge_audit_logs',
  ]);

  constructor(private db?: Database, approvalService?: HumanApprovalService) {
    this.approvalService = approvalService || new HumanApprovalService(db);
  }

  public classifyAction(actionName: string): { tier: PermissionTier; defaultOutcome: PermissionDecisionOutcome } {
    const normalized = actionName.trim().toLowerCase();

    if (this.GREEN_ACTIONS.has(normalized) || normalized.startsWith('get_') || normalized.startsWith('read_') || normalized.startsWith('list_') || normalized.startsWith('view_')) {
      return { tier: 'Green', defaultOutcome: 'allow' };
    }

    if (this.YELLOW_ACTIONS.has(normalized) || normalized.startsWith('preview_') || normalized.startsWith('test_') || normalized.startsWith('generate_')) {
      return { tier: 'Yellow', defaultOutcome: 'policy_approval_required' };
    }

    if (
      this.RED_ACTIONS.has(normalized) ||
      normalized.includes('prod') ||
      normalized.includes('deploy_production') ||
      normalized.includes('migration') ||
      normalized.includes('delete') ||
      normalized.includes('secret') ||
      normalized.includes('credential') ||
      normalized.includes('rollback')
    ) {
      return { tier: 'Red', defaultOutcome: 'human_approval_required' };
    }

    // Default Deny Rule for unrecognized/unknown actions
    return { tier: 'Red', defaultOutcome: 'deny' };
  }

  public async evaluatePermission(input: EvaluatePermissionInput): Promise<PermissionEvaluationResult> {
    const { action, actor, resourceId, context } = input;
    const now = new Date().toISOString();
    const decisionId = `perm_dec_${Math.random().toString(36).substring(2, 10)}`;

    const { tier, defaultOutcome } = this.classifyAction(action);
    let outcome: PermissionDecisionOutcome = defaultOutcome;
    let reason = '';

    if (tier === 'Green') {
      outcome = 'allow';
      reason = `[Green Tier] Safe read-only action '${action}' auto-allowed for ${actor}.`;
    } else if (tier === 'Yellow') {
      outcome = 'allow';
      reason = `[Yellow Tier] Policy-based action '${action}' allowed for ${actor} under policy rules.`;
    } else if (tier === 'Red') {
      // Red tier always requires human approval
      let isApproved = false;
      try {
        isApproved = await this.approvalService.verifyApproval('DATABASE_MIGRATION', resourceId);
      } catch {
        try {
          isApproved = await this.approvalService.verifyApproval('SECURITY_CREDENTIAL_ROTATION', resourceId);
        } catch {
          try {
            isApproved = await this.approvalService.verifyApproval('PRODUCTION_DEPLOYMENT', resourceId);
          } catch {
            try {
              isApproved = await this.approvalService.verifyApproval('MANUAL_ROLLBACK', resourceId);
            } catch {}
          }
        }
      }

      if (isApproved) {
        outcome = 'allow';
        reason = `[Red Tier] Critical action '${action}' allowed because explicit human approval was granted.`;
      } else {
        outcome = defaultOutcome === 'deny' ? 'deny' : 'human_approval_required';
        reason = `[Red Tier] Critical action '${action}' blocked: Mandatory human approval is required for production deploy, DB migration, delete operations, or secrets access.`;
      }
    }

    const cleanReason = redactString(reason);
    const cleanActor = redactString(actor);

    const result: PermissionEvaluationResult = {
      decisionId,
      action,
      tier,
      outcome,
      actor: cleanActor,
      resourceId: resourceId || null,
      reason: cleanReason,
      evaluatedAt: now,
    };

    if (this.db) {
      try {
        await this.db.insert(permissionDecisions).values({
          action,
          tier,
          decision: outcome,
          actor: cleanActor,
          resourceId: resourceId || null,
          reason: cleanReason,
          evaluatedAt: new Date(),
        });
      } catch {}
    }

    this.mockDecisions.set(decisionId, result);

    const auditEvent = outcome === 'allow' ? 'PERMISSION_GRANTED' : 'PERMISSION_DENIED';
    AuditLoggerService.log(
      auditEvent,
      `Permission evaluation for action '${action}' (${tier} Tier): ${outcome.toUpperCase()}`,
      outcome === 'allow' ? 'success' : 'failure',
      decisionId,
      redactObject({ action, tier, outcome, actor: cleanActor, resourceId, context })
    );

    return result;
  }

  public async enforcePermission(action: string, actor: string, resourceId?: string): Promise<void> {
    const evaluation = await this.evaluatePermission({ action, actor, resourceId });
    if (evaluation.outcome !== 'allow') {
      throw new AppError(
        'FORBIDDEN',
        `Permission Denied for action '${action}' (${evaluation.tier} Tier). ${evaluation.reason}`,
        403
      );
    }
  }

  public getRules(): Record<string, string[]> {
    return {
      Green: Array.from(this.GREEN_ACTIONS),
      Yellow: Array.from(this.YELLOW_ACTIONS),
      Red: Array.from(this.RED_ACTIONS),
    };
  }

  public async listPermissionAuditLogs(): Promise<PermissionEvaluationResult[]> {
    if (this.db) {
      try {
        const list = await this.db.select().from(permissionDecisions).orderBy(desc(permissionDecisions.createdAt));
        return list.map((r: any) =>
          redactObject({
            decisionId: r.id,
            action: r.action,
            tier: r.tier as PermissionTier,
            outcome: r.decision as PermissionDecisionOutcome,
            actor: r.actor,
            resourceId: r.resourceId,
            reason: r.reason,
            evaluatedAt: r.evaluatedAt ? new Date(r.evaluatedAt).toISOString() : new Date().toISOString(),
          })
        );
      } catch {}
    }

    return Array.from(this.mockDecisions.values()).map(r => redactObject(r));
  }
}
