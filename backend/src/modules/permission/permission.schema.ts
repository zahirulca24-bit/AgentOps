import { z } from 'zod';

export const permissionTierEnum = z.enum(['Green', 'Yellow', 'Red']);

export const permissionDecisionOutcomeEnum = z.enum([
  'allow',
  'policy_approval_required',
  'human_approval_required',
  'deny',
]);

export const evaluatePermissionSchema = z.object({
  action: z.string().min(1, 'Action identifier is required'),
  actor: z.string().min(1, 'Actor identity is required'),
  resourceId: z.string().optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export type PermissionTier = z.infer<typeof permissionTierEnum>;
export type PermissionDecisionOutcome = z.infer<typeof permissionDecisionOutcomeEnum>;
export type EvaluatePermissionInput = z.infer<typeof evaluatePermissionSchema>;
