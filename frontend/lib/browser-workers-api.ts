const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

export type BrowserWorkerSchedule = 'on_demand' | 'hourly' | 'daily' | 'weekly';
export type BrowserWorkerStatus = 'idle' | 'running' | 'paused' | 'error';

export type BrowserWorkerWorkflowStep =
  | { type: 'login' }
  | { type: 'navigate'; url: string }
  | { type: 'click'; selector: string }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'submit'; selector: string }
  | { type: 'wait'; timeoutMs?: number }
  | { type: 'logout'; selector?: string };

export interface BrowserWorkerLoginConfig {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  logoutSelector?: string;
}

export interface BrowserWorkerProject {
  id: string;
  name: string;
  targetUrl?: string | null;
}

export interface BrowserWorkerMetrics {
  functionalFailures: number;
  visualDefects: number;
  consoleErrors: number;
  networkFailures: number;
  totalFailures: number;
}

export interface BrowserWorkerComparison {
  status: 'first_run' | 'unchanged' | 'improved' | 'regressed';
  baselineRunId: string | null;
  previousStatus: string | null;
  currentStatus: string;
  deltas: {
    totalFailures: number;
    visualDefects: number;
    consoleErrors: number;
    networkFailures: number;
  };
}

export interface BrowserWorkerRun {
  id: string;
  workerId: string;
  trigger: 'manual' | 'scheduled';
  status: 'running' | 'passed' | 'failed' | 'error';
  currentAction: string;
  summary?: string | null;
  metrics?: BrowserWorkerMetrics | null;
  comparison?: BrowserWorkerComparison | null;
  report?: any;
  importantFailure: boolean;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
}

export interface BrowserWorker {
  id: string;
  projectId: string;
  project: BrowserWorkerProject | null;
  name: string;
  environment: string;
  targetUrl: string;
  scheduleType: BrowserWorkerSchedule;
  status: BrowserWorkerStatus;
  currentAction: string;
  credentialSecretRef?: string | null;
  loginConfig?: BrowserWorkerLoginConfig | null;
  workflow: BrowserWorkerWorkflowStep[];
  lastRunId?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastRun?: BrowserWorkerRun | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrowserWorkerNotification {
  id: string;
  workerId: string;
  workerRunId?: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
}

export interface VaultSecretSummary {
  id: string;
  secretRef: string;
  provider: string;
  version: number;
  status: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrowserWorkerPayload {
  projectId: string;
  name: string;
  environment: string;
  targetUrl?: string;
  scheduleType: BrowserWorkerSchedule;
  credentialSecretRef?: string | null;
  loginConfig?: BrowserWorkerLoginConfig | null;
  workflow?: BrowserWorkerWorkflowStep[];
}

export type UpdateBrowserWorkerPayload = Partial<Omit<CreateBrowserWorkerPayload, 'projectId'>>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Request failed (${response.status})`);
  return body as T;
}

export const browserWorkersApi = {
  baseUrl: API_BASE,
  listProjects: () => request<{ data: BrowserWorkerProject[] }>('/api/v1/projects'),
  listWorkers: () => request<{ data: BrowserWorker[] }>('/api/v1/browser-workers'),
  getWorker: (id: string) => request<{ data: BrowserWorker }>(`/api/v1/browser-workers/${id}`),
  createWorker: (payload: CreateBrowserWorkerPayload) => request<{ data: BrowserWorker }>('/api/v1/browser-workers', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  updateWorker: (id: string, payload: UpdateBrowserWorkerPayload) => request<{ data: BrowserWorker }>(`/api/v1/browser-workers/${id}`, {
    method: 'PATCH', body: JSON.stringify(payload),
  }),
  runNow: (id: string) => request<{ data: BrowserWorkerRun }>(`/api/v1/browser-workers/${id}/run`, { method: 'POST' }),
  pause: (id: string) => request<{ data: BrowserWorker }>(`/api/v1/browser-workers/${id}/pause`, { method: 'POST' }),
  resume: (id: string) => request<{ data: BrowserWorker }>(`/api/v1/browser-workers/${id}/resume`, { method: 'POST' }),
  history: (id: string) => request<{ data: BrowserWorkerRun[] }>(`/api/v1/browser-workers/${id}/history`),
  listNotifications: (unreadOnly = false) => request<{ data: BrowserWorkerNotification[] }>(`/api/v1/browser-worker-notifications${unreadOnly ? '?unreadOnly=true' : ''}`),
  markNotificationsRead: () => request<{ data: { success: boolean } }>('/api/v1/browser-worker-notifications/read-all', { method: 'POST' }),
  listVaultSecrets: () => request<{ success: boolean; count: number; secrets: VaultSecretSummary[] }>('/api/v1/vault/secrets'),
};

export function scheduleLabel(schedule: BrowserWorkerSchedule): string {
  if (schedule === 'on_demand') return 'On demand';
  return schedule.charAt(0).toUpperCase() + schedule.slice(1);
}

export function formatWorkerDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
