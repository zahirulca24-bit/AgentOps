import { z } from 'zod';

export const errorCategoryEnum = z.enum([
  'BUILD_SYNTAX_ERROR',
  'MISSING_DEPENDENCY',
  'COMPILATION_FAILURE',
  'DOCKER_BUILD_FAILURE',
  'RUNTIME_UNHANDLED_EXCEPTION',
  'RUNTIME_TYPE_ERROR',
  'DATABASE_CONNECTION_REFUSED',
  'OUT_OF_MEMORY',
  'ENVIRONMENT_CONFIG_ERROR',
  'HTTP_5XX_SERVER_ERROR',
  'UNKNOWN_ERROR',
]);

export const errorSeverityEnum = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
]);

export const deploymentErrorItemSchema = z.object({
  type: z.enum(['build', 'runtime']),
  category: errorCategoryEnum,
  severity: errorSeverityEnum,
  message: z.string(),
  lineContent: z.string().optional(),
  lineNumber: z.number().optional(),
});

export const deploymentLogAnalysisSchema = z.object({
  deploymentId: z.string().optional(),
  runId: z.string().optional(),
  outcome: z.enum(['PASS', 'FAIL']),
  overallSeverity: errorSeverityEnum,
  summary: z.string(),
  rootCause: z.string(),
  detectedErrors: z.array(deploymentErrorItemSchema),
  recommendation: z.string().optional(),
  analyzedAt: z.string(),
});

export const analyzeLogsInputSchema = z.object({
  deploymentId: z.string().optional(),
  runId: z.string().optional(),
  logs: z.string().min(1, 'Logs string is required for analysis'),
  provider: z.enum(['render', 'vercel']).optional(),
  branchName: z.string().optional(),
});

export type ErrorCategory = z.infer<typeof errorCategoryEnum>;
export type ErrorSeverity = z.infer<typeof errorSeverityEnum>;
export type DeploymentErrorItem = z.infer<typeof deploymentErrorItemSchema>;
export type DeploymentLogAnalysis = z.infer<typeof deploymentLogAnalysisSchema>;
export type AnalyzeLogsInput = z.infer<typeof analyzeLogsInputSchema>;
