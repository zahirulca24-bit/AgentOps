import { DashboardData } from '@/types';

/**
 * Isolated Preview Data for AgentOps Dashboard (Phase 1 / Prompt 4)
 *
 * This structured dataset provides operational context for the UI without
 * requiring backend services, WebSockets, or fake runtime timers.
 * All fields match the production TypeScript schema.
 */
export const OPERATIONAL_DASHBOARD_DATA: DashboardData = {
  metrics: {
    totalRuns: 48,
    running: 1,
    passed: 41,
    failed: 6,
    openIssues: 4,
  },

  currentActivity: {
    id: 'run_live_09x4a',
    runNumber: '#1048',
    name: 'Checkout Flow Regression & Stripe Webhook Sync',
    targetUrl: 'https://staging.ecommerce.internal/checkout',
    status: 'running',
    stage: 'Step 4/6: Asserting payment intent confirmation',
    progressPercent: 68,
    elapsedTime: '2m 18s',
    startedAt: '3 minutes ago',
    activeWorkers: 2,
    currentStep: 'DOM Assertion: [data-testid="order-confirmed"] element visible within 3000ms',
  },

  recentRuns: [
    {
      id: 'run_1048',
      runNumber: '#1048',
      name: 'Checkout Flow Regression & Stripe Webhook Sync',
      targetUrl: 'https://staging.ecommerce.internal/checkout',
      status: 'running',
      passedTests: 14,
      totalTests: 20,
      issuesCount: 0,
      startedAt: '3m ago',
      duration: 'In progress',
    },
    {
      id: 'run_1047',
      runNumber: '#1047',
      name: 'User Onboarding & Organization Creation Flow',
      targetUrl: 'https://app.agentops.internal/signup',
      status: 'success',
      passedTests: 24,
      totalTests: 24,
      issuesCount: 0,
      startedAt: '42m ago',
      duration: '4m 12s',
    },
    {
      id: 'run_1046',
      runNumber: '#1046',
      name: 'OAuth2 Social Login & Refresh Token Rotation',
      targetUrl: 'https://auth.agentops.internal/login',
      status: 'error',
      passedTests: 18,
      totalTests: 22,
      issuesCount: 2,
      startedAt: '2h ago',
      duration: '3m 45s',
    },
    {
      id: 'run_1045',
      runNumber: '#1045',
      name: 'Data Table Bulk Export & CSV Streaming',
      targetUrl: 'https://app.agentops.internal/reports',
      status: 'success',
      passedTests: 16,
      totalTests: 16,
      issuesCount: 0,
      startedAt: '5h ago',
      duration: '1m 55s',
    },
    {
      id: 'run_1044',
      runNumber: '#1044',
      name: 'Settings Billing Portal & Seat Management',
      targetUrl: 'https://billing.agentops.internal/seats',
      status: 'error',
      passedTests: 11,
      totalTests: 14,
      issuesCount: 2,
      startedAt: '9h ago',
      duration: '2m 38s',
    },
    {
      id: 'run_1043',
      runNumber: '#1043',
      name: 'API Gateway Rate Limiter & Fallback Headers',
      targetUrl: 'https://api.agentops.internal/v1/health',
      status: 'success',
      passedTests: 30,
      totalTests: 30,
      issuesCount: 0,
      startedAt: '1d ago',
      duration: '1m 04s',
    },
  ],

  issueSummary: {
    critical: 1,
    high: 2,
    medium: 1,
    low: 0,
    totalOpen: 4,
    recentIssues: [
      {
        id: 'iss_091',
        title: 'OAuth state token mismatch during concurrent redirect loops',
        severity: 'critical',
        targetUrl: 'auth.agentops.internal/login',
        timeAgo: '2h ago',
        runId: '#1046',
      },
      {
        id: 'iss_092',
        title: 'Billing portal seat increment button remains disabled on error recovery',
        severity: 'high',
        targetUrl: 'billing.agentops.internal/seats',
        timeAgo: '9h ago',
        runId: '#1044',
      },
      {
        id: 'iss_093',
        title: 'Invoice download trigger returns 404 on unfinalized subscriptions',
        severity: 'high',
        targetUrl: 'billing.agentops.internal/invoices',
        timeAgo: '9h ago',
        runId: '#1044',
      },
      {
        id: 'iss_094',
        title: 'Session storage cache key collision on rapid tab switches',
        severity: 'medium',
        targetUrl: 'auth.agentops.internal/session',
        timeAgo: '2h ago',
        runId: '#1046',
      },
    ],
  },

  systemStatus: [
    {
      id: 'sys_agent',
      name: 'Agent Engine',
      component: 'agent',
      status: 'success',
      statusLabel: 'Ready',
      version: 'v1.4.2',
      detail: '4 worker nodes standing by for prompt dispatch',
    },
    {
      id: 'sys_browser',
      name: 'Browser Cluster',
      component: 'browser',
      status: 'running',
      statusLabel: 'Active',
      version: 'Chromium 128 (Headless)',
      detail: '1 session connected on staging container #02',
    },
    {
      id: 'sys_api',
      name: 'Ops API & Telemetry',
      component: 'api',
      status: 'success',
      statusLabel: 'Operational',
      version: 'HTTP / gRPC v1.2',
      detail: 'Latency 18ms • Ingestion healthy',
    },
  ],
};

/**
 * Fresh-install empty state configuration for clean deployments.
 */
export const EMPTY_DASHBOARD_DATA: DashboardData = {
  metrics: {
    totalRuns: 0,
    running: 0,
    passed: 0,
    failed: 0,
    openIssues: 0,
  },
  currentActivity: null,
  recentRuns: [],
  issueSummary: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    totalOpen: 0,
    recentIssues: [],
  },
  systemStatus: [
    {
      id: 'sys_agent',
      name: 'Agent Engine',
      component: 'agent',
      status: 'success',
      statusLabel: 'Ready',
      version: 'v1.4.2',
      detail: 'Cluster initialized • Standing by for first run',
    },
    {
      id: 'sys_browser',
      name: 'Browser Cluster',
      component: 'browser',
      status: 'idle',
      statusLabel: 'Idle',
      version: 'Chromium 128 (Headless)',
      detail: 'No active browser sessions allocated',
    },
    {
      id: 'sys_api',
      name: 'Ops API & Telemetry',
      component: 'api',
      status: 'success',
      statusLabel: 'Operational',
      version: 'HTTP / gRPC v1.2',
      detail: 'Telemetry channel open',
    },
  ],
};
