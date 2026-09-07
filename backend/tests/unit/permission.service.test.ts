import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionEngineService } from '../../src/modules/permission/permission.service.js';
import { HumanApprovalService } from '../../src/modules/approval/approval.service.js';
import { AuditLoggerService } from '../../src/modules/audit/audit.service.js';

describe('Phase 3.7 — Permission Engine (Unit Tests)', () => {
  let engine: PermissionEngineService;
  let approvalService: HumanApprovalService;

  beforeEach(() => {
    AuditLoggerService.clearLogs();
    approvalService = new HumanApprovalService();
    engine = new PermissionEngineService(undefined, approvalService);
  });

  describe('3-Tier Action Classification (Green / Yellow / Red)', () => {
    it('classifies safe read operations as Green tier and auto-allows execution', async () => {
      const evaluation = await engine.evaluatePermission({
        action: 'view_report',
        actor: 'qa_user@agentops.ai',
      });

      expect(evaluation.tier).toBe('Green');
      expect(evaluation.outcome).toBe('allow');
      expect(evaluation.reason).toContain('Green Tier');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'PERMISSION_GRANTED' });
      expect(auditLogs.length).toBe(1);
    });

    it('classifies policy-based actions as Yellow tier and allows under policy rules', async () => {
      const evaluation = await engine.evaluatePermission({
        action: 'create_preview_deployment',
        actor: 'developer@agentops.ai',
      });

      expect(evaluation.tier).toBe('Yellow');
      expect(evaluation.outcome).toBe('allow');
      expect(evaluation.reason).toContain('Yellow Tier');
    });

    it('classifies critical actions as Red tier (Production deploy, DB migration, delete, secrets access) and requires human approval', async () => {
      const redActions = [
        'deploy_production',
        'db_migration',
        'delete_resource',
        'access_secrets',
        'rotate_credentials',
        'manual_rollback',
      ];

      for (const action of redActions) {
        const evaluation = await engine.evaluatePermission({
          action,
          actor: 'unapproved_user',
        });

        expect(evaluation.tier).toBe('Red');
        expect(evaluation.outcome).toBe('human_approval_required');
      }
    });

    it('applies DEFAULT DENY rule to unknown or unclassified critical write/delete actions', async () => {
      const evaluation = await engine.evaluatePermission({
        action: 'custom_unregistered_action',
        actor: 'unknown_bot',
      });

      expect(evaluation.tier).toBe('Red');
      expect(evaluation.outcome).toBe('deny');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'PERMISSION_DENIED' });
      expect(auditLogs.length).toBe(1);
    });
  });

  describe('Human Approval System Integration & Secret Redaction', () => {
    it('allows Red tier action when an explicit human approval is granted in approval system', async () => {
      const req = await approvalService.createApprovalRequest({
        actionCategory: 'PRODUCTION_DEPLOYMENT',
        actionSummary: 'Deploy release v3.7',
        requestedBy: 'dev-1',
        resourceId: 'prod_rel_307',
      });

      await approvalService.approveRequest(req.approvalId, 'infra-lead');

      // Now evaluate Red action with approved resource ID
      const evaluation = await engine.evaluatePermission({
        action: 'deploy_production',
        actor: 'dev-1',
        resourceId: 'prod_rel_307',
      });

      expect(evaluation.tier).toBe('Red');
      expect(evaluation.outcome).toBe('allow');
    });

    it('redacts secret tokens and credentials in permission evaluation reason and actor identity', async () => {
      const evaluation = await engine.evaluatePermission({
        action: 'access_secrets',
        actor: 'user_with_token: ghp_1234567890abcdef1234567890abcdef123456',
        context: { secretKey: 'super_secret_val' },
      });

      expect(evaluation.actor).not.toContain('ghp_1234567890abcdef');
      expect(evaluation.actor).toContain('[REDACTED_GITHUB_TOKEN]');
    });
  });
});
