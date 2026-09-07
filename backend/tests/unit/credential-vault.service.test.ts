import { describe, it, expect, beforeEach } from 'vitest';
import { CredentialBrokerService } from '../../src/modules/vault/credential-vault.service.js';
import { PermissionEngineService } from '../../src/modules/permission/permission.service.js';
import { HumanApprovalService } from '../../src/modules/approval/approval.service.js';
import { AuditLoggerService } from '../../src/modules/audit/audit.service.js';
import { redactString } from '../../src/infrastructure/redact/redactSensitive.js';

describe('Phase 3.8 — Credential Vault (Unit Tests)', () => {
  let broker: CredentialBrokerService;
  let approvalService: HumanApprovalService;
  let permissionEngine: PermissionEngineService;

  beforeEach(() => {
    AuditLoggerService.clearLogs();
    approvalService = new HumanApprovalService();
    permissionEngine = new PermissionEngineService(undefined, approvalService);
    broker = new CredentialBrokerService(undefined, permissionEngine);
  });

  async function approveSecretAccess(secretRef: string, actor: string = 'sec_admin') {
    const req = await approvalService.createApprovalRequest({
      actionCategory: 'SECURITY_CREDENTIAL_ROTATION',
      actionSummary: `Access secret ${secretRef}`,
      requestedBy: actor,
      resourceId: secretRef,
    });
    await approvalService.approveRequest(req.approvalId, 'security_lead');
  }

  describe('Secret Storage & Plaintext Protection', () => {
    it('stores a secret and returns a secret_ref token without exposing raw plaintext secret', async () => {
      const result = await broker.storeSecret(
        {
          provider: 'render',
          secretValue: 'rnd_secret_key_998877665544',
          description: 'Render API Token for Staging',
        },
        'sec_admin'
      );

      expect(result.secretRef).toMatch(/^sec_ref_render_/);
      expect(result.provider).toBe('render');
      expect(result.version).toBe(1);
      expect(result.status).toBe('active');
      expect((result as any).secretValue).toBeUndefined();
      expect((result as any).encryptedValue).toBeUndefined();

      // Audit log check
      const auditLogs = AuditLoggerService.getLogs({ eventType: 'SECRET_STORED' });
      expect(auditLogs.length).toBe(1);
      expect(JSON.stringify(auditLogs[0])).not.toContain('rnd_secret_key_998877665544');
    });

    it('dynamically registers stored secret for string redaction across logs and outputs', async () => {
      const rawSecret = 'super_secret_api_token_xyz99';
      await broker.storeSecret({
        provider: 'github',
        secretValue: rawSecret,
      });

      const logSample = `Connecting to GitHub using token value ${rawSecret} in raw payload`;
      const cleanLog = redactString(logSample);

      expect(cleanLog).not.toContain(rawSecret);
      expect(cleanLog).toContain('[REDACTED_VAULT_SECRET]');
    });
  });

  describe('Runtime Credential Broker & Provider Scoping', () => {
    it('brokers runtime credential injection when provider scope matches and actor is authorized', async () => {
      const stored = await broker.storeSecret(
        {
          provider: 'vercel',
          secretValue: 'ver_token_abc123xyz456',
        },
        'deploy_bot'
      );

      await approveSecretAccess(stored.secretRef, 'deploy_bot');

      const credential = await broker.resolveCredential({
        secretRef: stored.secretRef,
        provider: 'vercel',
        actor: 'deploy_bot',
      });

      expect(credential.secretRef).toBe(stored.secretRef);
      expect(credential.provider).toBe('vercel');
      expect(credential.secretValue).toBe('ver_token_abc123xyz456');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'SECRET_ACCESSED' });
      expect(auditLogs.length).toBe(1);
      expect(JSON.stringify(auditLogs[0])).not.toContain('ver_token_abc123xyz456');
    });

    it('blocks credential injection if provider scope does not match (e.g. Render token requested for Vercel)', async () => {
      const stored = await broker.storeSecret(
        {
          provider: 'render',
          secretValue: 'rnd_token_only_for_render',
        },
        'deploy_bot'
      );

      await approveSecretAccess(stored.secretRef, 'deploy_bot');

      await expect(
        broker.resolveCredential({
          secretRef: stored.secretRef,
          provider: 'vercel',
          actor: 'deploy_bot',
        })
      ).rejects.toThrow(/Provider scope mismatch/);
    });

    it('enforces PermissionEngine control before resolving credentials', async () => {
      const stored = await broker.storeSecret({
        provider: 'gcp',
        secretValue: 'gcp_sa_key_json_bytes',
      });

      // Without human approval for unauthorized actor, permission engine blocks access
      await expect(
        broker.resolveCredential({
          secretRef: stored.secretRef,
          provider: 'gcp',
          actor: 'unauthorized_guest_bot',
        })
      ).rejects.toThrow();
    });
  });

  describe('Secret Rotation Foundation & Revocation', () => {
    it('rotates secret value, increments version (v1 -> v2), and logs SECRET_ROTATED audit event', async () => {
      const stored = await broker.storeSecret(
        {
          provider: 'github',
          secretValue: 'gh_old_pat_version_1',
        },
        'sec_admin'
      );

      await approveSecretAccess(stored.secretRef, 'sec_admin');

      const rotated = await broker.rotateSecret({
        secretRef: stored.secretRef,
        newSecretValue: 'gh_new_pat_version_2',
        actor: 'sec_admin',
        reason: 'Scheduled quarterly key rotation',
      });

      expect(rotated.secretRef).toBe(stored.secretRef);
      expect(rotated.version).toBe(2);

      // Verify broker now resolves rotated value
      const resolved = await broker.resolveCredential({
        secretRef: stored.secretRef,
        provider: 'github',
        actor: 'sec_admin',
      });

      expect(resolved.secretValue).toBe('gh_new_pat_version_2');

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'SECRET_ROTATED' });
      expect(auditLogs.length).toBe(1);
      expect(JSON.stringify(auditLogs[0])).not.toContain('gh_new_pat_version_2');
    });

    it('revokes secret reference and blocks subsequent resolution attempts', async () => {
      const stored = await broker.storeSecret(
        {
          provider: 'generic',
          secretValue: 'api_key_to_be_revoked',
        },
        'sec_admin'
      );

      await approveSecretAccess(stored.secretRef, 'sec_admin');

      await broker.revokeSecret({
        secretRef: stored.secretRef,
        actor: 'sec_admin',
        reason: 'Security breach compromise',
      });

      await expect(
        broker.resolveCredential({
          secretRef: stored.secretRef,
          provider: 'generic',
          actor: 'sec_admin',
        })
      ).rejects.toThrow(/revoked/);

      const auditLogs = AuditLoggerService.getLogs({ eventType: 'SECRET_REVOKED' });
      expect(auditLogs.length).toBe(1);
    });
  });
});
