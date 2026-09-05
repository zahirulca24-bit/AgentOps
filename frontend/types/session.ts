export type ExecutionStageName =
  | 'Understanding'
  | 'Planning'
  | 'Launching Browser'
  | 'Exploring'
  | 'Testing'
  | 'Analyzing'
  | 'Complete';

export type StageState = 'pending' | 'active' | 'completed' | 'failed' | 'stopped';

export interface StageInfo {
  name: ExecutionStageName;
  state: StageState;
  startedAt?: string;
  duration?: string;
  description?: string;
}

export type SessionStatus = 'running' | 'completed' | 'failed' | 'paused' | 'stopped';

export type SessionEventType =
  | 'navigation'
  | 'click'
  | 'input'
  | 'assertion'
  | 'screenshot'
  | 'console'
  | 'network'
  | 'system';

export type EventStatus = 'success' | 'warning' | 'error' | 'info';

export interface SessionEvent {
  id: string;
  timestamp: string;
  relativeTime: string;
  type: SessionEventType;
  description: string;
  status: EventStatus;
  details?: {
    selector?: string;
    url?: string;
    value?: string;
    code?: string;
    message?: string;
  };
}

export interface ConsoleEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  source: string;
  stack?: string;
  count?: number;
}

export interface NetworkEvent {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  status: number;
  statusText: string;
  duration: string;
  size?: string;
  type: string;
  hasError: boolean;
}

export interface EvidenceItem {
  id: string;
  title: string;
  timestamp: string;
  stepNumber: number;
  stepName: string;
  type: 'screenshot' | 'dom_snapshot';
  caption: string;
  mockPreviewType: 'checkout_step' | 'cart_summary' | 'payment_error' | 'auth_dialog';
  highlightSelector?: string;
}

export interface BrowserSession {
  id: string;
  targetUrl: string;
  targetHost: string;
  prompt: string;
  status: SessionStatus;
  currentStage: ExecutionStageName;
  stages: StageInfo[];
  startedAt: string;
  duration: string;
  viewport: {
    width: number;
    height: number;
    userAgent: string;
  };
  events: SessionEvent[];
  consoleLogs: ConsoleEvent[];
  networkLogs: NetworkEvent[];
  evidence: EvidenceItem[];
  stats: {
    totalActions: number;
    assertionsPassed: number;
    assertionsFailed: number;
    consoleErrors: number;
    networkErrors: number;
  };
}
