import { z } from 'zod';

export const postDeploymentQAVerdictEnum = z.enum(['PASS', 'FAIL', 'DEGRADED']);

export const triggerPostDeploymentQABodySchema = z.object({
  forceReRun: z.boolean().optional().default(false),
  customTargetUrl: z.string().url().optional(),
});

export const postDeploymentQASummarySchema = z.object({
  deploymentId: z.string(),
  runId: z.string(),
  status: z.string(),
  targetUrl: z.string(),
  verdict: postDeploymentQAVerdictEnum,
  passedTests: z.number(),
  failedTests: z.number(),
  issuesCount: z.number(),
  evidenceCount: z.number(),
  consoleErrorCount: z.number(),
  networkErrorCount: z.number(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

export type PostDeploymentQAVerdict = z.infer<typeof postDeploymentQAVerdictEnum>;
export type TriggerPostDeploymentQABody = z.infer<typeof triggerPostDeploymentQABodySchema>;
export type PostDeploymentQASummary = z.infer<typeof postDeploymentQASummarySchema>;
