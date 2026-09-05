const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

export type ApiRunStatus = 'pending' | 'running' | 'passed' | 'completed' | 'failed' | 'error' | 'stopped' | 'aborted';
export type ApiIssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ApiIssueStatus = 'open' | 'resolved' | 'ignored';

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

export interface ApiIssue {
  id: string;
  runId: string;
  title: string;
  description?: string | null;
  severity: ApiIssueSeverity;
  category?: string | null;
  status: ApiIssueStatus;
  affectedUrl?: string | null;
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

export interface ApiRun {
  id: string;
  taskId: string;
  status: ApiRunStatus;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
  browserSessions?: ApiBrowserSession[];
  testResults?: ApiTestResult[];
  issues?: ApiIssue[];
  evidence?: ApiEvidence[];
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
  listIssues: () => request<ApiEnvelope<ApiIssue[]>>('/api/v1/issues'),
  getIssue: (id: string) => request<ApiEnvelope<ApiIssue>>(`/api/v1/issues/${id}`),
  listSessions: () => request<ApiEnvelope<ApiBrowserSession[]>>('/api/v1/browser-sessions'),
  getSession: (id: string) => request<ApiEnvelope<ApiBrowserSession>>(`/api/v1/browser-sessions/${id}`),
  cancelRun: (id: string) => request<ApiEnvelope<{ runId: string; status: string }>>(`/api/v1/runs/${id}/cancel`, { method: 'POST' }),
};
