import { z } from 'zod';

export const validateTokenSchema = z.object({
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const repoMetadataSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const testConnectionSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  token: z.string().min(1, 'GitHub token is required'),
  defaultBranch: z.string().optional().default('main'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const readFileSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().min(1, 'File path is required'),
  ref: z.string().optional(),
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const searchCodeSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  query: z.string().min(1, 'Search query is required'),
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const listBranchesSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const createTaskBranchSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  branchName: z.string().min(1, 'Task branch name is required'),
  fromBranch: z.string().optional(),
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const fileChangeSchema = z.object({
  path: z.string().min(1, 'File path is required'),
  content: z.string(),
  operation: z.enum(['create', 'update', 'delete']).optional().default('update'),
});

export const commitChangesSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  branch: z.string().min(1, 'Target task branch is required'),
  commitMessage: z.string().min(1, 'Commit message is required'),
  changes: z.array(fileChangeSchema).min(1, 'At least one file change must be provided'),
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const createPullRequestSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  head: z.string().min(1, 'Head task branch is required'),
  base: z.string().optional(),
  title: z.string().min(1, 'Pull request title is required'),
  body: z.string().optional(),
  findingSummary: z.object({
    title: z.string(),
    severity: z.string(),
    description: z.string(),
    expectedResult: z.string().optional(),
    actualResult: z.string().optional(),
  }).optional(),
  rootCauseAnalysis: z.object({
    likelyCause: z.string(),
    suspectedFileOrComponent: z.string().optional(),
    recommendedAction: z.string(),
    facts: z.array(z.string()).optional(),
    inference: z.array(z.string()).optional(),
  }).optional(),
  testRunnerResult: z.object({
    passed: z.boolean(),
    testSuitesRun: z.array(z.object({
      name: z.string(),
      passed: z.boolean(),
      logsSummary: z.string().optional(),
    })).optional(),
    durationMs: z.number().optional(),
    failedCommands: z.array(z.string()).optional(),
  }).optional(),
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export const prStatusSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  pullNumber: z.number().int().positive('Valid pull request number is required'),
  token: z.string().min(1, 'GitHub token is required'),
  baseUrl: z.string().url('Invalid baseUrl format').optional(),
});

export type ValidateTokenInput = z.infer<typeof validateTokenSchema>;
export type RepoMetadataInput = z.infer<typeof repoMetadataSchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
export type ReadFileInput = z.infer<typeof readFileSchema>;
export type SearchCodeInput = z.infer<typeof searchCodeSchema>;
export type ListBranchesInput = z.infer<typeof listBranchesSchema>;
export type CreateTaskBranchInput = z.infer<typeof createTaskBranchSchema>;
export type CommitChangesInput = z.infer<typeof commitChangesSchema>;
export type CreatePullRequestInput = z.infer<typeof createPullRequestSchema>;
export type PRStatusInput = z.infer<typeof prStatusSchema>;

