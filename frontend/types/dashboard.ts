import { StatusType } from './index';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface DashboardMetrics {
  totalRuns: number;
  running: number;
  passed: number;
  failed: number;
  openIssues: number;
}

export interface ActiveRunActivity {
  id: string;
  runNumber: string;
  name: string;
  targetUrl: string;
  status: StatusType;
  stage: string;
  progressPercent: number;
  elapsedTime: string;
  startedAt: string;
  activeWorkers: number;
  currentStep: string;
}

export interface RecentRun {
  id: string;
  runNumber: string;
  name: string;
  targetUrl: string;
  status: StatusType;
  passedTests: number;
  totalTests: number;
  issuesCount: number;
  startedAt: string;
  duration: string;
}

export interface RecentIssue {
  id: string;
  title: string;
  severity: IssueSeverity;
  targetUrl: string;
  timeAgo: string;
  runId: string;
}

export interface IssueSummaryData {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalOpen: number;
  recentIssues: RecentIssue[];
}

export interface SystemServiceStatus {
  id: string;
  name: string;
  component: 'agent' | 'browser' | 'api';
  status: StatusType;
  statusLabel: string;
  version: string;
  detail: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  currentActivity: ActiveRunActivity | null;
  recentRuns: RecentRun[];
  issueSummary: IssueSummaryData;
  systemStatus: SystemServiceStatus[];
}
