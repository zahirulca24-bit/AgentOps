import { z } from 'zod';

export const rollbackModeEnum = z.enum(['automatic', 'manual']);
export const rollbackStatusEnum = z.enum(['initiated', 'restoring', 'restored', 'failed']);

export const autoRollbackSchema = z.object({
  targetProductionId: z.string().min(1, 'Target production deployment ID is required'),
  reason: z.string().optional(),
});

export const manualRollbackSchema = z.object({
  targetProductionId: z.string().min(1, 'Target production deployment ID is required'),
  restoredProductionId: z.string().optional(),
  initiatedBy: z.string().min(1, 'Initiator identity is required'),
  approvedBy: z.string().min(1, 'Approver identity is required for manual rollback approval'),
  reason: z.string().min(1, 'Rollback reason is required'),
});

export type RollbackMode = z.infer<typeof rollbackModeEnum>;
export type RollbackStatus = z.infer<typeof rollbackStatusEnum>;
export type AutoRollbackInput = z.infer<typeof autoRollbackSchema>;
export type ManualRollbackInput = z.infer<typeof manualRollbackSchema>;
