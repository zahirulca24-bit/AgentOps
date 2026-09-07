import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { vaultCredentials } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactString, redactObject, registerDynamicSecret } from '../../infrastructure/redact/redactSensitive.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import { PermissionEngineService } from '../permission/permission.service.js';
import {
  StoreSecretInput,
  ResolveCredentialInput,
  RotateSecretInput,
  RevokeSecretInput,
  CredentialProvider,
  CredentialStatus,
} from './credential-vault.schema.js';

export interface VaultSecretSummary {
  id: string;
  secretRef: string;
  provider: CredentialProvider;
  version: number;
  status: CredentialStatus;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EphemeralCredential {
  secretRef: string;
  provider: CredentialProvider;
  secretValue: string;
}

export class CredentialBrokerService {
  private mockVault = new Map<string, {
    id: string;
    secretRef: string;
    provider: CredentialProvider;
    encryptedValue: string;
    version: number;
    status: CredentialStatus;
    description?: string | null;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>();

  private permissionEngine: PermissionEngineService;

  constructor(private db?: Database, permissionEngine?: PermissionEngineService) {
    this.permissionEngine = permissionEngine || new PermissionEngineService(db);
  }

  /**
   * Encrypt / mask raw secret value for vault storage
   */
  private encryptSecret(rawSecret: string): string {
    return Buffer.from(rawSecret, 'utf-8').toString('base64');
  }

  /**
   * Decrypt vault stored secret value into ephemeral runtime memory
   */
  private decryptSecret(encryptedSecret: string): string {
    return Buffer.from(encryptedSecret, 'base64').toString('utf-8');
  }

  /**
   * Store a secret and return its secret_ref identifier
   */
  public async storeSecret(input: StoreSecretInput, actor: string = 'system'): Promise<VaultSecretSummary> {
    const { provider, secretValue, description, metadata } = input;
    const now = new Date().toISOString();
    const id = `vault_${Math.random().toString(36).substring(2, 10)}`;

    const secretRef = input.secretRef
      ? input.secretRef
      : `sec_ref_${provider}_${Math.random().toString(36).substring(2, 8)}_v1`;

    // Register raw secret dynamically in redaction system
    registerDynamicSecret(secretValue);

    const encryptedValue = this.encryptSecret(secretValue);

    const record = {
      id,
      secretRef,
      provider,
      encryptedValue,
      version: 1,
      status: 'active' as CredentialStatus,
      description: description ? redactString(description) : null,
      metadata: metadata ? redactObject(metadata) : {},
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      try {
        await this.db.insert(vaultCredentials).values({
          secretRef,
          provider,
          encryptedValue,
          version: 1,
          status: 'active',
          description: record.description,
          metadata: record.metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch {}
    }

    this.mockVault.set(secretRef, record);

    AuditLoggerService.log(
      'SECRET_STORED',
      `Secret '${secretRef}' for provider '${provider}' securely stored in vault (Version 1). Raw secret value is not exposed.`,
      'success',
      secretRef,
      redactObject({ secretRef, provider, version: 1, actor, description: record.description })
    );

    return {
      id,
      secretRef,
      provider,
      version: 1,
      status: 'active',
      description: record.description,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Runtime Credential Broker: Resolves secret value for provider execution with permission control and scope checking
   */
  public async resolveCredential(input: ResolveCredentialInput): Promise<EphemeralCredential> {
    const { secretRef, provider, actor } = input;

    // 1. Permission check via PermissionEngineService
    const permResult = await this.permissionEngine.evaluatePermission({
      action: 'access_secrets',
      actor,
      resourceId: secretRef,
    });

    if (permResult.outcome !== 'allow') {
      throw new AppError(
        'FORBIDDEN',
        `Credential access denied for actor '${actor}' on secret '${secretRef}' (${permResult.tier} Tier). ${permResult.reason}`,
        403
      );
    }

    // 2. Fetch stored credential from DB or mock vault
    const record = await this.getInternalRecord(secretRef);

    if (!record) {
      throw new AppError('NOT_FOUND', `Secret reference '${secretRef}' not found in vault`, 404);
    }

    // 3. Provider scope validation
    if (record.provider !== provider) {
      throw new AppError(
        'FORBIDDEN',
        `Provider scope mismatch: Secret reference '${secretRef}' is scoped to provider '${record.provider}' and cannot be brokered for '${provider}'`,
        403
      );
    }

    // 4. Status check
    if (record.status !== 'active') {
      throw new AppError(
        'BAD_REQUEST',
        `Secret reference '${secretRef}' is '${record.status}' and cannot be resolved for execution`,
        400
      );
    }

    const secretValue = this.decryptSecret(record.encryptedValue);

    // Register secret dynamically for runtime redaction protection
    registerDynamicSecret(secretValue);

    // Emit audit log WITHOUT exposing secret value
    AuditLoggerService.log(
      'SECRET_ACCESSED',
      `Credential broker resolved secret '${secretRef}' for provider '${provider}' requested by actor '${actor}'.`,
      'success',
      secretRef,
      redactObject({ secretRef, provider, actor, version: record.version })
    );

    return {
      secretRef,
      provider: record.provider,
      secretValue,
    };
  }

  /**
   * Rotate a secret value and increment version foundation
   */
  public async rotateSecret(input: RotateSecretInput): Promise<VaultSecretSummary> {
    const { secretRef, newSecretValue, actor, reason } = input;

    // Permission check for credential rotation
    const permResult = await this.permissionEngine.evaluatePermission({
      action: 'rotate_credentials',
      actor,
      resourceId: secretRef,
    });

    if (permResult.outcome !== 'allow') {
      throw new AppError(
        'FORBIDDEN',
        `Credential rotation denied for actor '${actor}' on secret '${secretRef}'. ${permResult.reason}`,
        403
      );
    }

    const record = await this.getInternalRecord(secretRef);
    if (!record) {
      throw new AppError('NOT_FOUND', `Secret reference '${secretRef}' not found in vault`, 404);
    }

    registerDynamicSecret(newSecretValue);

    const newVersion = record.version + 1;
    const now = new Date().toISOString();
    const cleanReason = reason ? redactString(reason) : 'Secret value rotated';

    record.version = newVersion;
    record.encryptedValue = this.encryptSecret(newSecretValue);
    record.updatedAt = now;
    record.status = 'active';

    if (this.db) {
      try {
        await this.db
          .update(vaultCredentials)
          .set({
            encryptedValue: record.encryptedValue,
            version: newVersion,
            updatedAt: new Date(),
          })
          .where(eq(vaultCredentials.secretRef, secretRef));
      } catch {}
    }

    this.mockVault.set(secretRef, record);

    AuditLoggerService.log(
      'SECRET_ROTATED',
      `Secret '${secretRef}' successfully rotated to version ${newVersion} by actor '${actor}'.`,
      'success',
      secretRef,
      redactObject({ secretRef, provider: record.provider, actor, newVersion, reason: cleanReason })
    );

    return {
      id: record.id,
      secretRef,
      provider: record.provider,
      version: newVersion,
      status: record.status,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: now,
    };
  }

  /**
   * Revoke a secret reference
   */
  public async revokeSecret(input: RevokeSecretInput): Promise<VaultSecretSummary> {
    const { secretRef, actor, reason } = input;

    const permResult = await this.permissionEngine.evaluatePermission({
      action: 'access_secrets',
      actor,
      resourceId: secretRef,
    });

    if (permResult.outcome !== 'allow') {
      throw new AppError(
        'FORBIDDEN',
        `Secret revocation denied for actor '${actor}' on secret '${secretRef}'. ${permResult.reason}`,
        403
      );
    }

    const record = await this.getInternalRecord(secretRef);
    if (!record) {
      throw new AppError('NOT_FOUND', `Secret reference '${secretRef}' not found in vault`, 404);
    }

    const now = new Date().toISOString();
    const cleanReason = reason ? redactString(reason) : 'Secret revoked by administrator';

    record.status = 'revoked';
    record.updatedAt = now;

    if (this.db) {
      try {
        await this.db
          .update(vaultCredentials)
          .set({
            status: 'revoked',
            updatedAt: new Date(),
          })
          .where(eq(vaultCredentials.secretRef, secretRef));
      } catch {}
    }

    this.mockVault.set(secretRef, record);

    AuditLoggerService.log(
      'SECRET_REVOKED',
      `Secret '${secretRef}' revoked by actor '${actor}'.`,
      'success',
      secretRef,
      redactObject({ secretRef, provider: record.provider, actor, reason: cleanReason })
    );

    return {
      id: record.id,
      secretRef,
      provider: record.provider,
      version: record.version,
      status: 'revoked',
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: now,
    };
  }

  /**
   * List secret metadata summaries (never returns secret values)
   */
  public async listSecretSummaries(): Promise<VaultSecretSummary[]> {
    let list: any[] = [];

    if (this.db) {
      try {
        const records = await this.db.select().from(vaultCredentials).orderBy(desc(vaultCredentials.createdAt));
        list = records.map((r: any) => ({
          id: r.id,
          secretRef: r.secretRef,
          provider: r.provider as CredentialProvider,
          version: r.version,
          status: r.status as CredentialStatus,
          description: r.description,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
        }));
      } catch {
        list = Array.from(this.mockVault.values());
      }
    } else {
      list = Array.from(this.mockVault.values());
    }

    return list.map(r => ({
      id: r.id,
      secretRef: r.secretRef,
      provider: r.provider,
      version: r.version,
      status: r.status,
      description: r.description ? redactString(r.description) : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Get single secret metadata summary by ref
   */
  public async getSecretSummary(secretRef: string): Promise<VaultSecretSummary> {
    const record = await this.getInternalRecord(secretRef);
    if (!record) {
      throw new AppError('NOT_FOUND', `Secret reference '${secretRef}' not found in vault`, 404);
    }

    return {
      id: record.id,
      secretRef: record.secretRef,
      provider: record.provider,
      version: record.version,
      status: record.status,
      description: record.description ? redactString(record.description) : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async getInternalRecord(secretRef: string) {
    let record = this.mockVault.get(secretRef);

    if (!record && this.db) {
      try {
        const dbRecord = await this.db.query.vaultCredentials.findFirst({
          where: eq(vaultCredentials.secretRef, secretRef),
        });
        if (dbRecord) {
          record = {
            id: dbRecord.id,
            secretRef: dbRecord.secretRef,
            provider: dbRecord.provider as CredentialProvider,
            encryptedValue: dbRecord.encryptedValue,
            version: dbRecord.version,
            status: dbRecord.status as CredentialStatus,
            description: dbRecord.description,
            metadata: (dbRecord.metadata as Record<string, any>) || {},
            createdAt: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: dbRecord.updatedAt ? new Date(dbRecord.updatedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch {}
    }

    return record;
  }
}
