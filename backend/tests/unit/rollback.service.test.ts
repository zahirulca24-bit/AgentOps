import { describe, it, expect, beforeEach } from 'vitest';
import { RollbackService } from '../../src/modules/deployment/rollback.service.js';
import { ProductionDeploymentService } from '../../src/modules/deployment/production-deployment.service.js';
import { AuditLoggerService } from '../../src/modules/audit/audit.service.js';

describe('Phase 3.5 — Rollback System (Unit Tests)', () => {
  let rollbackService: RollbackService;
  let prodService: ProductionDeploymentService;

  beforeEach(() => {
    AuditLoggerService.clearLogs();
    prodService = new ProductionDeploymentService();
    rollbackService = prodService.rollbackService;
  });

  describe('Automatic Emergency Rollback', () => {
    it('automatically triggers emergency rollback on production deployment execution failure', async () => {
      const req = await prodService.requestProductionDeployment({
        previewDeploymentId: 'dpl_preview_ready_auto_roll',
        provider: 'render',
        branchName: 'agentops/task-auto-fail',
        requestedBy: 'developer',
      });

      await prodService.approveProductionDeployment({
        productionDeploymentId: req.productionDeploymentId,
        approvedBy: 'lead-approver',
        decision: 'approved',
      });

      const execResult = await prodService.executeProductionDeployment({
        productionDeploymentId: req.productionDeploymentId,
        simulateFailure: true,
        apiToken: 'secret_token_123',
      });

      expect(execResult.status).toBe('failed');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'ROLLBACK_INITIATED' });
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].metadata?.mode).toBe('automatic');
    });

    it('returns clear failure reason when no previous stable production deployment exists', async () => {
      const targetId = 'prod_dep_no_stable';
      const result = await rollbackService.executeAutoRollback({
        targetProductionId: targetId,
        reason: 'Container startup crash',
      });

      expect(result.status).toBe('failed');
      expect(result.errorDetails).toContain('No previous stable production deployment found');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'ROLLBACK_FAILED' });
      expect(auditLogs.length).toBe(1);
    });
  });

  describe('Manual Rollback with Human Approval & Secret Redaction', () => {
    it('executes manual rollback when authorized human approver specifies target and reason', async () => {
      const targetId = 'prod_dep_manual_target';
      const result = await rollbackService.executeManualRollback({
        targetProductionId: targetId,
        initiatedBy: 'ops-engineer@agentops.ai',
        approvedBy: 'infra-lead@agentops.ai',
        reason: 'High latency observed after release. Reverting to token: secret_token_xyz',
      });

      expect(result.mode).toBe('manual');
      expect(result.status).toBe('restored');
      expect(result.initiatedBy).toBe('ops-engineer@agentops.ai');
      expect(result.approvedBy).toBe('infra-lead@agentops.ai');
      expect(result.rollbackReason).not.toContain('secret_token_xyz');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'ROLLBACK_COMPLETED' });
      expect(auditLogs.length).toBe(1);
    });

    it('blocks manual rollback if human approver identity (approvedBy) is missing', async () => {
      await expect(
        rollbackService.executeManualRollback({
          targetProductionId: 'prod_dep_unapproved',
          initiatedBy: 'anonymous',
          approvedBy: '',
          reason: 'Emergency revert',
        })
      ).rejects.toThrow('Manual rollback requires human approval policy validation');
    });
  });
});
