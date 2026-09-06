import type { TestType, TestRunnerResult } from '../runner/runner.types.js';
import type { CodeFixProposalResponse } from '../fix/fix.service.js';
import type { GitHubCommitResult, GitHubPullRequest } from '../github/github.types.js';
import type { RootCauseAnalysisOutput } from '../analysis/analysis.schema.js';

export interface SelfFixAttemptRecord {
  attemptNumber: number;
  fixProposal: CodeFixProposalResponse;
  testResult: TestRunnerResult;
  commitResult?: GitHubCommitResult;
  status: 'passed' | 'failed' | 'rejected_duplicate' | 'error';
  patchSignature: string;
  timestamp: string;
  errorDetails?: string;
}

export interface SelfFixLoopInput {
  issueId: string;
  branchName: string;
  maxAttempts?: number;
  files?: Array<{ path: string; content: string }>;
  githubRepo?: {
    owner: string;
    repo: string;
    token: string;
    defaultBranch?: string;
    baseUrl?: string;
  };
  suiteTypes?: TestType[];
}

export interface SelfFixLoopResult {
  issueId: string;
  branchName: string;
  success: boolean;
  status: 'fixed' | 'escalated' | 'failed';
  winningAttempt?: number | null;
  totalAttempts: number;
  pullRequest?: GitHubPullRequest | null;
  attempts: SelfFixAttemptRecord[];
  rootCauseAnalysis?: RootCauseAnalysisOutput | null;
  escalationReason?: string | null;
  escalationSummary?: string | null;
}
