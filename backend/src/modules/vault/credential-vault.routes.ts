import { FastifyInstance } from 'fastify';
import { CredentialBrokerService } from './credential-vault.service.js';
import {
  storeSecretSchema,
  resolveCredentialSchema,
  rotateSecretSchema,
  revokeSecretSchema,
} from './credential-vault.schema.js';

export async function credentialVaultRoutes(app: FastifyInstance) {
  const service = new CredentialBrokerService((app as any).db);

  // Store a secret in the vault (returns secretRef)
  app.post('/api/v1/vault/secrets', async (request, reply) => {
    const body = storeSecretSchema.parse(request.body);
    const actor = (request.headers['x-actor-id'] as string) || 'admin';
    const summary = await service.storeSecret(body, actor);
    return reply.status(201).send({
      success: true,
      message: 'Secret securely stored in vault',
      secret: summary,
    });
  });

  // List secret metadata summaries (never returns raw secret values)
  app.get('/api/v1/vault/secrets', async (_request, reply) => {
    const secrets = await service.listSecretSummaries();
    return reply.send({
      success: true,
      count: secrets.length,
      secrets,
    });
  });

  // Get single secret metadata summary
  app.get('/api/v1/vault/secrets/:ref', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const summary = await service.getSecretSummary(ref);
    return reply.send({
      success: true,
      secret: summary,
    });
  });

  // Runtime Credential Broker: Resolve scoped credential for execution
  app.post('/api/v1/vault/secrets/:ref/resolve', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const body = resolveCredentialSchema.parse({
      secretRef: ref,
      ...(request.body as object),
    });

    const credential = await service.resolveCredential(body);
    return reply.send({
      success: true,
      message: 'Credential successfully brokered for runtime execution',
      credential,
    });
  });

  // Rotate a secret value
  app.post('/api/v1/vault/secrets/:ref/rotate', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const body = rotateSecretSchema.parse({
      secretRef: ref,
      ...(request.body as object),
    });

    const updated = await service.rotateSecret(body);
    return reply.send({
      success: true,
      message: 'Secret rotated successfully',
      secret: updated,
    });
  });

  // Revoke a secret
  app.post('/api/v1/vault/secrets/:ref/revoke', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const body = revokeSecretSchema.parse({
      secretRef: ref,
      ...(request.body as object),
    });

    const updated = await service.revokeSecret(body);
    return reply.send({
      success: true,
      message: 'Secret revoked successfully',
      secret: updated,
    });
  });
}
