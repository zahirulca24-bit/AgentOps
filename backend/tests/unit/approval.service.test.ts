import { describe, it, expect, beforeEach } from 'vitest';
import { HumanApprovalService } from '../../src/modules/approval/approval.service.js';
import { AuditLoggerService } from '../../src/modules/audit/audit.service.js';

describe('Phase 3.6 — Human Approval System (Unit Tests)', () => {
  let service: HumanApprovalService;

  beforeEach(() => {
    AuditLoggerService.clearLogs();
    service = new HumanApprovalService();
  });

  describe('Approval Request Creation & Execution Pause', () => {
    it('creates an approval request for critical action and pauses execution with pending status', async () => {
      const request = await service.createApprovalRequest({
        actionCategory: 'PRODUCTION_DEPLOYMENT',
        actionSummary: 'Deploy release v2.0 to Production environment',
        requestedBy: 'developer@agentops.ai',
        resourceId: 'prod_dep_101',
        reason: 'Release includes Phase 3 features with token: secret_token_xyz',
      });

      expect(request.approvalId).toBeDefined();
      expect(request.status).toBe('pending');
      expect(request.actionCategory).toBe('PRODUCTION_DEPLOYMENT');
      expect(request.requestedBy).toBe('developer@agentops.ai');
      expect(request.reason).not.toContain('secret_token_xyz');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'HUMAN_APPROVAL_REQUESTED' });
      expect(auditLogs.length).toBe(1);
    });

    it('blocks execution when verifying approval if request is still pending or not approved', async () => {
      await expect(
        service.verifyApproval('DATABASE_MIGRATION', 'db_mig_202')
      ).rejects.toThrow('Execution blocked: Critical action \'DATABASE_MIGRATION\' requires an approved human approval request');
    });
  });

  describe('Approval Decisions & Execution Resume', () => {
    it('resumes execution when human approver grants approval', async () => {
      const req = await service.createApprovalRequest({
        actionCategory: 'MANUAL_ROLLBACK',
        actionSummary: 'Rollback production to stable release v1.9',
        requestedBy: 'ops-engineer',
        resourceId: 'rollback_303',
      });

      const approved = await service.approveRequest(req.approvalId, 'security-lead@agentops.ai', 'Risk assessed and approved');

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe('security-lead@agentops.ai');
      expect(approved.decidedAt).toBeDefined();

      const isValid = await service.verifyApproval('MANUAL_ROLLBACK', 'rollback_303');
      expect(isValid).toBe(true);

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'HUMAN_APPROVAL_GRANTED' });
      expect(auditLogs.length).toBe(1);
    });

    it('keeps execution blocked when human approver rejects the approval request', async () => {
      const req = await service.createApprovalRequest({
        actionCategory: 'DESTRUCTIVE_INFRA_ACTION',
        actionSummary: 'Drop legacy staging database cluster',
        requestedBy: 'junior-dev',
        resourceId: 'cluster_db_legacy',
      });

      const rejected = await service.rejectRequest(req.approvalId, 'infra-architect@agentops.ai', 'Destructive action blocked in staging period with token: secret_api_key_val');

      expect(rejected.status).toBe('rejected');
      expect(rejected.approvedBy).toBe('infra-architect@agentops.ai');
      expect(rejected.reason).not.toContain('secret_api_key_val');

      await expect(
        service.verifyApproval('DESTRUCTIVE_INFRA_ACTION', 'cluster_db_legacy')
      ).rejects.toThrow('Execution blocked');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'HUMAN_APPROVAL_REJECTED' });
      expect(auditLogs.length).toBe(1);
    });
  });
});
