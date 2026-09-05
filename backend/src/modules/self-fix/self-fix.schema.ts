import { z } from 'zod';

export const selfFixLoopInputSchema = z.object({
  branchName: z.string().min(1, 'Target task branch name is required'),
  maxAttempts: z.number().int().min(1).max(3).optional().default(3),
  files: z.array(z.object({
    path: z.string().min(1),
    content: z.string(),
  })).optional(),
  githubRepo: z.object({
    owner: z.string().min(1, 'GitHub owner is required'),
    repo: z.string().min(1, 'GitHub repo is required'),
    token: z.string().min(1, 'GitHub token is required'),
    defaultBranch: z.string().optional().default('main'),
    baseUrl: z.string().url().optional(),
  }).optional(),
  suiteTypes: z.array(z.enum(['unit', 'integration', 'browser_qa', 'changed_area_regression'])).optional(),
});

export type SelfFixLoopInputSchemaType = z.infer<typeof selfFixLoopInputSchema>;
