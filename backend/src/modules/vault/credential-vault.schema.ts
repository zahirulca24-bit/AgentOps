import { z } from 'zod';

export const credentialProviderEnum = z.enum(['render', 'vercel', 'github', 'gcp', 'generic']);
export type CredentialProvider = z.infer<typeof credentialProviderEnum>;

export const credentialStatusEnum = z.enum(['active', 'rotated', 'revoked']);
export type CredentialStatus = z.infer<typeof credentialStatusEnum>;

export const storeSecretSchema = z.object({
  secretRef: z.string().trim().min(3).optional(),
  provider: credentialProviderEnum,
  secretValue: z.string().min(1, 'Secret value is required'),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
export type StoreSecretInput = z.infer<typeof storeSecretSchema>;

export const resolveCredentialSchema = z.object({
  secretRef: z.string().trim().min(3),
  provider: credentialProviderEnum,
  actor: z.string().trim().min(1),
});
export type ResolveCredentialInput = z.infer<typeof resolveCredentialSchema>;

export const rotateSecretSchema = z.object({
  secretRef: z.string().trim().min(3),
  newSecretValue: z.string().min(1, 'New secret value is required'),
  actor: z.string().trim().min(1),
  reason: z.string().optional(),
});
export type RotateSecretInput = z.infer<typeof rotateSecretSchema>;

export const revokeSecretSchema = z.object({
  secretRef: z.string().trim().min(3),
  actor: z.string().trim().min(1),
  reason: z.string().optional(),
});
export type RevokeSecretInput = z.infer<typeof revokeSecretSchema>;
