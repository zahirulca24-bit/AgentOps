import { z } from 'zod';

export const testTypeEnum = z.enum(['unit', 'integration', 'browser_qa', 'changed_area_regression']);

export const testRunnerInputSchema = z.object({
  branchName: z.string().min(1, 'Target task branch name is required'),
  issueId: z.string().uuid().optional(),
  suiteTypes: z.array(testTypeEnum).optional().default(['unit', 'integration', 'changed_area_regression']),
  changedFiles: z.array(z.string()).optional().default([]),
  timeoutMs: z.number().int().min(1000).max(120000).optional().default(30000),
  maxOutputBytes: z.number().int().min(1000).max(1000000).optional().default(100000),
});

export type TestRunnerInput = z.infer<typeof testRunnerInputSchema>;
