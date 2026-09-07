import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { credentialVaultRoutes } from '../../src/modules/vault/credential-vault.routes.js';
import { approvalRoutes } from '../../src/modules/approval/approval.routes.js';

describe('Phase 3.8 — Credential Vault Integration Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(approvalRoutes);
    await app.register(credentialVaultRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function approveSecretAccess(secretRef: string, actor: string = 'sec_admin') {
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/approvals/request',
      payload: {
        actionCategory: 'SECURITY_CREDENTIAL_ROTATION',
        actionSummary: `Access secret ${secretRef}`,
        requestedBy: actor,
        resourceId: secretRef,
      },
    });
    const reqId = JSON.parse(reqRes.payload).data.approvalId;

    await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${reqId}/approve`,
      payload: {
        actor: 'security_lead',
        reason: 'Access approved for test',
      },
    });
  }

  it('POST /api/v1/vault/secrets stores secret and returns secret_ref metadata without raw value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vault/secrets',
      payload: {
        provider: 'render',
        secretValue: 'rnd_prod_api_key_secret_val',
        description: 'Production Render Deploy Key',
      },
      headers: {
        'x-actor-id': 'sec_admin',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.secret.secretRef).toMatch(/^sec_ref_render_/);
    expect(body.secret.provider).toBe('render');
    expect(body.secret.version).toBe(1);
    expect(body.secret.secretValue).toBeUndefined();
    expect(res.payload).not.toContain('rnd_prod_api_key_secret_val');
  });

  it('GET /api/v1/vault/secrets lists secret summaries without exposing plaintext secrets', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/vault/secrets',
      payload: {
        provider: 'github',
        secretValue: 'ghp_secret_pat_value_xyz',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vault/secrets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.secrets.length).toBeGreaterThan(0);
    expect(res.payload).not.toContain('ghp_secret_pat_value_xyz');
  });

  it('POST /api/v1/vault/secrets/:ref/resolve brokers runtime credential for authorized actor and matching provider', async () => {
    const storeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/vault/secrets',
      payload: {
        provider: 'vercel',
        secretValue: 'ver_api_token_12345',
      },
    });
    const secretRef = JSON.parse(storeRes.payload).secret.secretRef;

    await approveSecretAccess(secretRef, 'deploy_bot');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/vault/secrets/${secretRef}/resolve`,
      payload: {
        provider: 'vercel',
        actor: 'deploy_bot',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.credential.secretRef).toBe(secretRef);
    expect(body.credential.provider).toBe('vercel');
    expect(body.credential.secretValue).toBe('ver_api_token_12345');
  });

  it('POST /api/v1/vault/secrets/:ref/rotate updates version and rotates secret value', async () => {
    const storeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/vault/secrets',
      payload: {
        provider: 'gcp',
        secretValue: 'gcp_v1_key',
      },
    });
    const secretRef = JSON.parse(storeRes.payload).secret.secretRef;

    await approveSecretAccess(secretRef, 'sec_admin');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/vault/secrets/${secretRef}/rotate`,
      payload: {
        newSecretValue: 'gcp_v2_key_updated',
        actor: 'sec_admin',
        reason: 'Key renewal',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.secret.version).toBe(2);
  });
});
