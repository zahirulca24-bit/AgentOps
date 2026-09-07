import { z } from 'zod';

export const criticalActionCategoryEnum = z.enum([
  'PRODUCTION_DEPLOYMENT',
  'MANUAL_ROLLBACK',
  'DATABASE_MIGRATION',
  'SECURITY_CREDENTIAL_ROTATION',
  'DESTRUCTIVE_INFRA_ACTION',
]);

export const approvalStatusEnum = z.enum(['pending', 'approved', 'rejected', 'expired']);

export const createApprovalRequestSchema = z.object({
  actionCategory: criticalActionCategoryEnum,
  actionSummary: z.string().min(1, 'Action summary is required'),
  requestedBy: z.string().min(1, 'Requester identity is required'),
  resourceId: z.string().optional(),
  reason: z.string().optional(),
});

export const decideApprovalSchema = z.object({
  actor: z.string().min(1, 'Approver/rejecter identity is required'),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
});

export type CriticalActionCategory = z.infer<typeof criticalActionCategoryEnum>;
export type ApprovalStatus = z.infer<typeof approvalStatusEnum>;
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;
export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;
