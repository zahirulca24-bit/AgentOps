export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  token: string;
  defaultBranch?: string;
  baseUrl?: string;
}

export interface MaskedGitHubRepoConfig {
  id?: string;
  projectId?: string | null;
  owner: string;
  repo: string;
  defaultBranch: string;
  baseUrl: string;
  maskedToken: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatarUrl?: string | null;
  type: string;
}

export interface GitHubPermissions {
  admin: boolean;
  push: boolean;
  pull: boolean;
}

export interface GitHubRepoMetadata {
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  permissions: GitHubPermissions;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
}

export interface GitHubConnectionTestResult {
  success: boolean;
  authenticatedUser: string | null;
  repo: GitHubRepoMetadata | null;
  permissions: GitHubPermissions | null;
  error?: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  content: string;
  encoding: string;
  downloadUrl: string | null;
  htmlUrl: string | null;
}

export interface GitHubCodeSearchItem {
  name: string;
  path: string;
  sha: string;
  htmlUrl: string;
  repository?: string;
}

export interface GitHubSearchResult {
  totalCount: number;
  items: GitHubCodeSearchItem[];
}

export interface GitHubBranch {
  name: string;
  commitSha: string;
  isProtected: boolean;
}

export interface GitHubBranchPermissionResult {
  canCreateBranch: boolean;
  isProtected: boolean;
  canPushDirectly: boolean;
  reason?: string;
}

export interface GitHubFileChange {
  path: string;
  content: string;
  operation?: 'create' | 'update' | 'delete';
}

export interface GitHubCommitInput {
  owner: string;
  repo: string;
  branch: string;
  commitMessage: string;
  changes: GitHubFileChange[];
  token: string;
  baseUrl?: string;
}

export interface GitHubCommitResult {
  commitSha: string;
  branch: string;
  filesCommitted: string[];
  commitUrl?: string;
}

export interface GitHubPullRequestFindingSummary {
  title: string;
  severity: string;
  description: string;
  expectedResult?: string;
  actualResult?: string;
}

export interface GitHubPullRequestRootCause {
  likelyCause: string;
  suspectedFileOrComponent?: string;
  recommendedAction: string;
  facts?: string[];
  inference?: string[];
}

export interface GitHubPullRequestTestResult {
  passed: boolean;
  testSuitesRun?: Array<{ name: string; passed: boolean; logsSummary?: string }>;
  durationMs?: number;
  failedCommands?: string[];
}

export interface GitHubPullRequestInput {
  owner: string;
  repo: string;
  head: string;
  base?: string;
  title: string;
  body?: string;
  findingSummary?: GitHubPullRequestFindingSummary;
  rootCauseAnalysis?: GitHubPullRequestRootCause;
  testRunnerResult?: GitHubPullRequestTestResult;
  token: string;
  baseUrl?: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  htmlUrl: string;
  headBranch: string;
  baseBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubCheckRunStatus {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | null;
  htmlUrl: string;
}

export interface GitHubCombinedStatus {
  state: 'pending' | 'success' | 'failure' | 'error';
  totalCount: number;
  statuses: Array<{
    context: string;
    state: string;
    description: string | null;
    targetUrl: string | null;
  }>;
}

export interface GitHubPRCheckStatusResult {
  prNumber: number;
  headSha: string;
  overallStatus: 'passed' | 'failed' | 'pending' | 'unknown';
  checkRuns: GitHubCheckRunStatus[];
  combinedStatus: GitHubCombinedStatus | null;
}

