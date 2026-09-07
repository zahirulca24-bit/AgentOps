import { z } from 'zod';

export const requestProductionDeploymentSchema = z.object({
  previewDeploymentId: z.string({ required_error: 'Preview deployment ID is required' }),
  provider: z.enum(['render', 'vercel']),
  branchName: z.string().min(1, 'Target branch name is required'),
  requestedBy: z.string().min(1, 'Requester identity is required'),
  targetEnvironment: z.string().optional().default('production'),
});

export const approveProductionDeploymentSchema = z.object({
  productionDeploymentId: z.string({ required_error: 'Production deployment ID is required' }),
  approvedBy: z.string().min(1, 'Approver identity is required for human approval'),
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
});

export const executeProductionDeploymentSchema = z.object({
  productionDeploymentId: z.string({ required_error: 'Production deployment ID is required' }),
  apiToken: z.string().optional(),
  simulateFailure: z.boolean().optional(),
});

export type RequestProductionDeploymentInput = z.infer<typeof requestProductionDeploymentSchema>;
export type ApproveProductionDeploymentInput = z.infer<typeof approveProductionDeploymentSchema>;
export type ExecuteProductionDeploymentInput = z.infer<typeof executeProductionDeploymentSchema>;
