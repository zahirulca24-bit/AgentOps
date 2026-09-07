import { z } from 'zod';

export const createPreviewDeploymentSchema = z.object({
  provider: z.enum(['render', 'vercel']),
  branchName: z.string().min(1, 'Target branch name is required'),
  repoOwner: z.string().optional(),
  repoName: z.string().optional(),
  prNumber: z.coerce.number().int().positive().optional(),
  commitSha: z.string().optional(),
  apiToken: z.string().optional(),
  serviceId: z.string().optional(),
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  customDomain: z.string().optional(),
  environmentVars: z.record(z.string(), z.string()).optional(),
  simulateFailure: z.boolean().optional(),
});

export const getDeploymentStatusSchema = z.object({
  provider: z.enum(['render', 'vercel']),
  branchName: z.string().min(1, 'Target branch name is required'),
  prNumber: z.coerce.number().int().positive().optional(),
  simulateFailure: z.boolean().optional(),
});
