import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionDeploymentService } from '../../src/modules/deployment/production-deployment.service.js';
import { AuditLoggerService } from '../../src/modules/audit/audit.service.js';

describe('Phase 3.4 — Production Deployment Service (Unit Tests)', () => {
  let prodService: ProductionDeploymentService;

  beforeEach(() => {
    AuditLoggerService.clearLogs();
    prodService = new ProductionDeploymentService();
  });

  describe('Gatekeeping Policy Enforcement', () => {
    it('allows production deployment request when preview status is ready and QA pass', async () => {
      const previewId = 'dpl_preview_ready_valid';
      const result = await prodService.requestProductionDeployment({
        previewDeploymentId: previewId,
        provider: 'render',
        branchName: 'agentops/task-prod-1',
        requestedBy: 'developer@agentops.ai',
      });

      expect(result.productionDeploymentId).toBeDefined();
      expect(result.status).toBe('pending_approval');
      expect(result.approvalStatus).toBe('pending');

      const logs = AuditLoggerService.getLogs({ eventType: 'PRODUCTION_DEPLOYMENT_REQUESTED' });
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Human Approval Requirement Enforcement', () => {
    it('blocks execution of production deployment if human approval is pending or not granted', async () => {
      const previewId = 'dpl_preview_ready_human_test';
      const requestResult = await prodService.requestProductionDeployment({
        previewDeploymentId: previewId,
        provider: 'vercel',
        branchName: 'agentops/task-human-gate',
        requestedBy: 'dev-lead',
      });

      await expect(
        prodService.executeProductionDeployment({
          productionDeploymentId: requestResult.productionDeploymentId,
        })
      ).rejects.toThrow('requires explicit human approval before execution');
    });

    it('approves production deployment request when human approver approves it', async () => {
      const requestResult = await prodService.requestProductionDeployment({
        previewDeploymentId: 'dpl_preview_human_approve',
        provider: 'render',
        branchName: 'agentops/task-approve-flow',
        requestedBy: 'dev-1',
      });

      const approvalResult = await prodService.approveProductionDeployment({
        productionDeploymentId: requestResult.productionDeploymentId,
        approvedBy: 'qa-lead@agentops.ai',
        decision: 'approved',
      });

      expect(approvalResult.approvalStatus).toBe('approved');
      expect(approvalResult.approvedBy).toBe('qa-lead@agentops.ai');
      expect(approvalResult.approvedAt).toBeDefined();

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'PRODUCTION_DEPLOYMENT_APPROVED' });
      expect(auditLogs.length).toBe(1);
    });

    it('handles rejection by human approver cleanly', async () => {
      const requestResult = await prodService.requestProductionDeployment({
        previewDeploymentId: 'dpl_preview_human_reject',
        provider: 'vercel',
        branchName: 'agentops/task-reject-flow',
        requestedBy: 'dev-2',
      });

      const rejectionResult = await prodService.approveProductionDeployment({
        productionDeploymentId: requestResult.productionDeploymentId,
        approvedBy: 'sec-lead@agentops.ai',
        decision: 'rejected',
        rejectionReason: 'Security approval missing for token: ghp_secret123',
      });

      expect(rejectionResult.approvalStatus).toBe('rejected');
      expect(rejectionResult.status).toBe('rejected');
      expect(rejectionResult.rejectionReason).not.toContain('ghp_secret123');
      expect(rejectionResult.rejectionReason).toContain('[REDACTED_GITHUB_TOKEN]');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'PRODUCTION_DEPLOYMENT_REJECTED' });
      expect(auditLogs.length).toBe(1);
    });
  });

  describe('Production Execution, Secret Redaction, and Failure Safety', () => {
    it('executes an approved production deployment, captures production URL, and redacts secrets', async () => {
      const req = await prodService.requestProductionDeployment({
        previewDeploymentId: 'dpl_preview_ready_exec',
        provider: 'render',
        branchName: 'agentops/task-prod-release',
        requestedBy: 'release-manager',
      });

      await prodService.approveProductionDeployment({
        productionDeploymentId: req.productionDeploymentId,
        approvedBy: 'tech-lead',
        decision: 'approved',
      });

      const execResult = await prodService.executeProductionDeployment({
        productionDeploymentId: req.productionDeploymentId,
        apiToken: 'secret_prod_token_9999',
      });

      expect(execResult.status).toBe('live');
      expect(execResult.productionUrl).toContain('agentops-agentops-task-prod-release.onrender.com');
      expect(execResult.buildLogs).not.toContain('secret_prod_token_9999');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'PRODUCTION_DEPLOYMENT_EXECUTED' });
      expect(auditLogs.length).toBe(1);
    });

    it('safely handles simulated production build failures without crashing app', async () => {
      const req = await prodService.requestProductionDeployment({
        previewDeploymentId: 'dpl_preview_ready_fail_test',
        provider: 'vercel',
        branchName: 'agentops/task-broken-prod',
        requestedBy: 'dev-3',
      });

      await prodService.approveProductionDeployment({
        productionDeploymentId: req.productionDeploymentId,
        approvedBy: 'tech-lead',
        decision: 'approved',
      });

      const execResult = await prodService.executeProductionDeployment({
        productionDeploymentId: req.productionDeploymentId,
        simulateFailure: true,
        apiToken: 'secret_fail_token',
      });

      expect(execResult.status).toBe('failed');
      expect(execResult.errorDetails).toBeDefined();
      expect(execResult.errorDetails).not.toContain('secret_fail_token');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'PRODUCTION_DEPLOYMENT_FAILED' });
      expect(auditLogs.length).toBe(1);
    });
  });
});
