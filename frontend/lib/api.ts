const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

export type ApiRunStatus = 'pending' | 'running' | 'passed' | 'completed' | 'failed' | 'error' | 'stopped' | 'aborted';
export type ApiIssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ApiIssueStatus = 'open' | 'investigating' | 'fixed' | 'closed';

export interface ApiTestResult {
  id: string;
  runId: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'stopped' | 'skipped';
  durationMs?: number | null;
  summary?: string | null;
  errorMessage?: string | null;
  screenshotRef?: string | null;
  createdAt: string;
}

export interface ApiEvidence {
  id: string;
  runId: string;
  type: string;
  storageRef: string;
  description?: string | null;
  createdAt: string;
}

export interface ApiRootCauseAnalysis {
  likelyCause: string;
  confidence: 'high' | 'medium' | 'low';
  affectedArea: string;
  suspectedComponent?: string | null;
  recommendedNextAction: string;
  facts: string[];
  inference: string;
}

export interface ApiIssue {
  id: string;
  runId: string;
  testResultId?: string | null;
  browserSessionId?: string | null;
  title: string;
  description?: string | null;
  severity: ApiIssueSeverity;
  severityReason?: string | null;
  category?: string | null;
  status: ApiIssueStatus;
  reproductionSteps?: string[] | any | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  screenshotEvidence?: string[] | any | null;
  consoleEvidence?: string[] | any | null;
  networkEvidence?: string[] | any | null;
  affectedUrl?: string | null;
  rootCauseAnalysis?: ApiRootCauseAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiBrowserSession {
  id: string;
  runId: string;
  status: 'active' | 'closed' | 'crashed';
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
}

export interface ApiProject {
  id: string;
  name: string;
  targetUrl?: string | null;
  createdAt: string;
}

export interface ApiTask {
  id: string;
  projectId: string;
  command: string;
  targetUrl?: string | null;
  status: string;
  project?: ApiProject;
}

export interface ApiRun {
  id: string;
  taskId: string;
  task?: ApiTask;
  status: ApiRunStatus;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
  browserSessions?: ApiBrowserSession[];
  testResults?: ApiTestResult[];
  issues?: ApiIssue[];
  evidence?: ApiEvidence[];
}

export interface ApiGitHubUser {
  login: string;
  id: number;
  avatarUrl?: string | null;
  type: string;
}

export interface ApiGitHubPermissions {
  admin: boolean;
  push: boolean;
  pull: boolean;
}

export interface ApiGitHubRepoMetadata {
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  permissions: ApiGitHubPermissions;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
}

export interface ApiGitHubConnectionResult {
  success: boolean;
  authenticatedUser: string | null;
  repo: ApiGitHubRepoMetadata | null;
  permissions: ApiGitHubPermissions | null;
  error?: string;
}

export interface ApiGitHubFileContent {
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

export interface ApiGitHubCodeSearchItem {
  name: string;
  path: string;
  sha: string;
  htmlUrl: string;
  repository?: string;
}

export interface ApiGitHubSearchResult {
  totalCount: number;
  items: ApiGitHubCodeSearchItem[];
}

export interface ApiGitHubBranch {
  name: string;
  commitSha: string;
  isProtected: boolean;
}

export interface ApiFileChange {
  path: string;
  originalContent?: string;
  newContent: string;
  diff?: string;
}

export interface ApiCodeFixProposal {
  issueId: string;
  targetBranch: string;
  explanation: string;
  changedFiles: string[];
  fileChanges: ApiFileChange[];
  riskNotes: string[];
}

export interface ApiTestSuiteRunResult {
  type: 'unit' | 'integration' | 'browser_qa' | 'changed_area_regression';
  command: string;
  passed: boolean;
  durationMs: number;
  errorSummary?: string;
  stdoutSnippet?: string;
}

export interface ApiTestRunnerResult {
  passed: boolean;
  failedCommands: string[];
  logsSummary: string;
  durationMs: number;
  affectedBranch: string;
  issueId?: string | null;
  testSuitesRun: ApiTestSuiteRunResult[];
}

export interface ApiGitHubCommitResult {
  commitSha: string;
  branch: string;
  filesCommitted: string[];
  commitUrl?: string;
}

export interface ApiGitHubPullRequest {
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

export interface ApiGitHubPRCheckStatusResult {
  prNumber: number;
  headSha: string;
  overallStatus: 'passed' | 'failed' | 'pending' | 'unknown';
  checkRuns: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    htmlUrl: string;
  }>;
  combinedStatus: {
    state: string;
    totalCount: number;
    statuses: Array<{ context: string; state: string; description: string | null; targetUrl: string | null }>;
  } | null;
}

export interface ApiSelfFixAttemptRecord {
  attemptNumber: number;
  fixProposal: ApiCodeFixProposal;
  testResult: ApiTestRunnerResult;
  commitResult?: ApiGitHubCommitResult;
  status: 'passed' | 'failed' | 'rejected_duplicate' | 'error';
  patchSignature: string;
  timestamp: string;
  errorDetails?: string;
}

export interface ApiSelfFixLoopResult {
  issueId: string;
  branchName: string;
  success: boolean;
  status: 'fixed' | 'escalated' | 'failed';
  winningAttempt?: number | null;
  totalAttempts: number;
  pullRequest?: ApiGitHubPullRequest | null;
  attempts: ApiSelfFixAttemptRecord[];
  rootCauseAnalysis?: ApiRootCauseAnalysis | null;
  escalationReason?: string | null;
  escalationSummary?: string | null;
}

interface ApiEnvelope<T> { data: T }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  baseUrl: API_BASE,
  createProject: (name: string, targetUrl: string) =>
    request<ApiEnvelope<{ id: string }>>('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name, targetUrl }) }),
  createTask: (projectId: string, command: string, targetUrl: string) =>
    request<ApiEnvelope<{ id: string }>>('/api/v1/tasks', { method: 'POST', body: JSON.stringify({ projectId, command, targetUrl }) }),
  executeTask: (taskId: string) =>
    request<ApiEnvelope<{ run: ApiRun; testsGenerated: number; results: ApiTestResult[] }>>(`/api/v1/tasks/${taskId}/execute`, { method: 'POST' }),
  listRuns: () => request<ApiEnvelope<ApiRun[]>>('/api/v1/runs'),
  getRun: (id: string) => request<ApiEnvelope<ApiRun>>(`/api/v1/runs/${id}`),
  listIssues: (params?: { runId?: string; severity?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.runId) searchParams.set('runId', params.runId);
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.status) searchParams.set('status', params.status);
    const queryStr = searchParams.toString();
    return request<ApiEnvelope<ApiIssue[]>>(`/api/v1/issues${queryStr ? `?${queryStr}` : ''}`);
  },
  getIssue: (id: string) => request<ApiEnvelope<ApiIssue>>(`/api/v1/issues/${id}`),
  createIssue: (issueData: Partial<ApiIssue> & { runId: string; title: string; severity: ApiIssueSeverity }) =>
    request<ApiEnvelope<ApiIssue>>('/api/v1/issues', { method: 'POST', body: JSON.stringify(issueData) }),
  updateIssue: (id: string, issueData: Partial<ApiIssue>) =>
    request<ApiEnvelope<ApiIssue>>(`/api/v1/issues/${id}`, { method: 'PATCH', body: JSON.stringify(issueData) }),
  analyzeIssue: (id: string) =>
    request<ApiEnvelope<{ issue: ApiIssue; analysis: ApiRootCauseAnalysis }>>(`/api/v1/issues/${id}/analyze`, { method: 'POST' }),
  listSessions: () => request<ApiEnvelope<ApiBrowserSession[]>>('/api/v1/browser-sessions'),
  getSession: (id: string) => request<ApiEnvelope<ApiBrowserSession>>(`/api/v1/browser-sessions/${id}`),
  cancelRun: (id: string) => request<ApiEnvelope<{ runId: string; status: string }>>(`/api/v1/runs/${id}/cancel`, { method: 'POST' }),
  validateGitHubToken: (token: string, baseUrl?: string) =>
    request<ApiEnvelope<{ authenticatedUser: ApiGitHubUser }>>('/api/v1/github/validate-token', { method: 'POST', body: JSON.stringify({ token, baseUrl }) }),
  getGitHubRepoMetadata: (owner: string, repo: string, token: string, baseUrl?: string) =>
    request<ApiEnvelope<{ repo: ApiGitHubRepoMetadata }>>('/api/v1/github/repo-metadata', { method: 'POST', body: JSON.stringify({ owner, repo, token, baseUrl }) }),
  testGitHubConnection: (owner: string, repo: string, token: string, defaultBranch?: string, baseUrl?: string) =>
    request<ApiEnvelope<{ connection: ApiGitHubConnectionResult; config: any }>>('/api/v1/github/test-connection', { method: 'POST', body: JSON.stringify({ owner, repo, token, defaultBranch, baseUrl }) }),
  readGitHubFile: (owner: string, repo: string, path: string, ref?: string, token?: string, baseUrl?: string) =>
    request<ApiEnvelope<{ file: ApiGitHubFileContent }>>('/api/v1/github/read-file', { method: 'POST', body: JSON.stringify({ owner, repo, path, ref, token, baseUrl }) }),
  searchGitHubCode: (owner: string, repo: string, query: string, token?: string, baseUrl?: string) =>
    request<ApiEnvelope<{ search: ApiGitHubSearchResult }>>('/api/v1/github/search-code', { method: 'POST', body: JSON.stringify({ owner, repo, query, token, baseUrl }) }),
  listGitHubBranches: (owner: string, repo: string, token?: string, baseUrl?: string) =>
    request<ApiEnvelope<{ branches: ApiGitHubBranch[] }>>('/api/v1/github/branches', { method: 'POST', body: JSON.stringify({ owner, repo, token, baseUrl }) }),
  createGitHubTaskBranch: (owner: string, repo: string, branchName: string, fromBranch?: string, token?: string, baseUrl?: string) =>
    request<ApiEnvelope<{ branch: ApiGitHubBranch }>>('/api/v1/github/create-task-branch', { method: 'POST', body: JSON.stringify({ owner, repo, branchName, fromBranch, token, baseUrl }) }),
  commitGitHubChanges: (owner: string, repo: string, branch: string, commitMessage: string, changes: Array<{ path: string; content: string; operation?: string }>, token: string, baseUrl?: string) =>
    request<ApiEnvelope<{ commit: ApiGitHubCommitResult }>>('/api/v1/github/commit', { method: 'POST', body: JSON.stringify({ owner, repo, branch, commitMessage, changes, token, baseUrl }) }),
  createGitHubPullRequest: (payload: { owner: string; repo: string; head: string; base?: string; title: string; body?: string; findingSummary?: any; rootCauseAnalysis?: any; testRunnerResult?: any; token: string; baseUrl?: string }) =>
    request<ApiEnvelope<{ pullRequest: ApiGitHubPullRequest }>>('/api/v1/github/pulls', { method: 'POST', body: JSON.stringify(payload) }),
  getGitHubPRCheckStatus: (owner: string, repo: string, pullNumber: number, token: string, baseUrl?: string) =>
    request<ApiEnvelope<{ status: ApiGitHubPRCheckStatusResult }>>('/api/v1/github/pr-status', { method: 'POST', body: JSON.stringify({ owner, repo, pullNumber, token, baseUrl }) }),
  generateIssueCodeFix: (id: string, payload: { branchName: string; files?: Array<{ path: string; content: string }>; githubRepo?: any }) =>
    request<ApiEnvelope<{ proposal: ApiCodeFixProposal }>>(`/api/v1/issues/${id}/fix`, { method: 'POST', body: JSON.stringify(payload) }),
  runCodeFixTests: (payload: { branchName: string; issueId?: string; suiteTypes?: string[]; changedFiles?: string[] }) =>
    request<ApiEnvelope<{ testRun: ApiTestRunnerResult }>>('/api/v1/fix-runner/run', { method: 'POST', body: JSON.stringify(payload) }),
  runSelfFixLoop: (issueId: string, payload: { branchName: string; maxAttempts?: number; files?: Array<{ path: string; content: string }>; githubRepo?: any; suiteTypes?: string[] }) =>
    request<ApiEnvelope<{ loopResult: ApiSelfFixLoopResult }>>(`/api/v1/issues/${issueId}/self-fix`, { method: 'POST', body: JSON.stringify(payload) }),
};


