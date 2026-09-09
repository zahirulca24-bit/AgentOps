import { eq } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { vaultCredentials } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactObject, registerDynamicSecret } from '../../infrastructure/redact/redactSensitive.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import { PermissionEngineService } from '../permission/permission.service.js';

export interface TestUserCredential {
  username: string;
  password: string;
}

/**
 * Internal-only broker for scheduled QA browser execution.
 * It resolves a generic Credential Vault secret_ref into ephemeral memory only.
 * No route exposes the returned username/password and both values are immediately
 * registered with the global redactor before browser actions execute.
 */
export class ExecutionCredentialBrokerService {
  private permissionEngine: PermissionEngineService;

  constructor(private db: Database, permissionEngine?: PermissionEngineService) {
    this.permissionEngine = permissionEngine || new PermissionEngineService(db);
  }

  public async resolveTestUser(secretRef: string, actor: string): Promise<TestUserCredential> {
    const permission = await this.permissionEngine.evaluatePermission({
      action: 'trigger_qa_run',
      actor,
      resourceId: secretRef,
      context: { credentialUse: 'execution_only', secretRef },
    });

    if (permission.outcome !== 'allow') {
      throw new AppError('FORBIDDEN', 'Browser Worker test credential use is not allowed by policy', 403);
    }

    const record = await this.db.query.vaultCredentials.findFirst({
      where: eq(vaultCredentials.secretRef, secretRef),
    });

    if (!record) throw new AppError('NOT_FOUND', `Credential Vault secret_ref '${secretRef}' was not found`, 404);
    if (record.provider !== 'generic') {
      throw new AppError('VALIDATION_ERROR', 'Browser Worker test-user credentials must use the generic vault provider', 400);
    }
    if (record.status !== 'active') {
      throw new AppError('VALIDATION_ERROR', `Credential Vault secret_ref '${secretRef}' is not active`, 400);
    }

    let raw: string;
    try {
      raw = Buffer.from(record.encryptedValue, 'base64').toString('utf-8');
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Credential Vault entry could not be resolved for test execution', 500);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AppError('VALIDATION_ERROR', 'Browser Worker test-user secret must be JSON with username and password fields', 400);
    }

    const username = typeof parsed?.username === 'string' ? parsed.username : '';
    const password = typeof parsed?.password === 'string' ? parsed.password : '';
    if (!username || !password) {
      throw new AppError('VALIDATION_ERROR', 'Browser Worker test-user secret must contain username and password fields', 400);
    }

    registerDynamicSecret(raw);
    registerDynamicSecret(username);
    registerDynamicSecret(password);

    AuditLoggerService.log(
      'TEST_CREDENTIAL_BROKERED',
      `Execution-only test credential '${secretRef}' was brokered for Browser Worker '${actor}'.`,
      'success',
      secretRef,
      redactObject({ secretRef, actor, provider: record.provider, version: record.version, credentialUse: 'execution_only' })
    );

    return { username, password };
  }
}
