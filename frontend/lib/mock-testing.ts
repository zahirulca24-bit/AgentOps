export type RunStatus = 'passed' | 'failed' | 'running' | 'queued';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'investigating' | 'resolved';

export interface TestRun {
  id: string;
  suiteName: string;
  targetEnvironment: string;
  status: RunStatus;
  passCount: number;
  failCount: number;
  skipCount: number;
  duration: string;
  startedAt: string;
  browser: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  discoveredAt: string;
  runId: string;
  url: string;
}

export interface ReportContent {
  id: string;
  title: string;
  type: 'compliance' | 'coverage' | 'summary';
  generatedAt: string;
  score: number;
  status: 'ready' | 'generating';
}

export const MOCK_RUNS: TestRun[] = [
  {
    id: 'run_9012',
    suiteName: 'Core E-Commerce Checkout (P0)',
    targetEnvironment: 'Staging',
    status: 'failed',
    passCount: 42,
    failCount: 3,
    skipCount: 0,
    duration: '4m 12s',
    startedAt: '10 mins ago',
    browser: 'Chromium',
  },
  {
    id: 'run_9011',
    suiteName: 'User Authentication Flow',
    targetEnvironment: 'Production',
    status: 'passed',
    passCount: 28,
    failCount: 0,
    skipCount: 0,
    duration: '1m 45s',
    startedAt: '1 hour ago',
    browser: 'Webkit',
  },
  {
    id: 'run_9010',
    suiteName: 'Search & Filtering Edge Cases',
    targetEnvironment: 'Development',
    status: 'running',
    passCount: 15,
    failCount: 0,
    skipCount: 2,
    duration: '2m 10s',
    startedAt: 'Just now',
    browser: 'Firefox',
  },
  {
    id: 'run_9009',
    suiteName: 'Payment Gateway Integration',
    targetEnvironment: 'Staging',
    status: 'passed',
    passCount: 56,
    failCount: 0,
    skipCount: 0,
    duration: '5m 30s',
    startedAt: 'Yesterday',
    browser: 'Chromium',
  },
];

export const MOCK_ISSUES: Issue[] = [
  {
    id: 'ISS-1042',
    title: 'Payment gateway declines valid test cards with 402 error',
    description: 'Agent observed that using the standard Stripe test card triggers a 3D Secure modal which the headless flow cannot bypass natively.',
    severity: 'critical',
    status: 'open',
    discoveredAt: '2 hours ago',
    runId: 'run_9012',
    url: 'https://ecommerce.example.com/checkout',
  },
  {
    id: 'ISS-1041',
    title: 'Profile avatar upload fails silently on mobile viewport',
    description: 'When viewport width is < 768px, the upload button is occluded by the sticky footer, causing the agent click to fail.',
    severity: 'high',
    status: 'investigating',
    discoveredAt: '1 day ago',
    runId: 'run_8055',
    url: 'https://staging.example.com/settings/profile',
  },
  {
    id: 'ISS-1040',
    title: 'Contrast ratio below WCAG AA standard on secondary buttons',
    description: 'Automated accessibility scan flagged the "Cancel" button with a contrast ratio of 3.2:1 (requires 4.5:1).',
    severity: 'low',
    status: 'resolved',
    discoveredAt: '3 days ago',
    runId: 'run_8010',
    url: 'https://ecommerce.example.com/cart',
  },
];

export const MOCK_REPORTS: ReportContent[] = [
  {
    id: 'rep_001',
    title: 'Weekly E-Commerce Regression Summary',
    type: 'summary',
    generatedAt: 'Today, 08:00 AM',
    score: 94,
    status: 'ready',
  },
  {
    id: 'rep_002',
    title: 'WCAG 2.1 Accessibility Audit',
    type: 'compliance',
    generatedAt: 'Yesterday, 03:30 PM',
    score: 88,
    status: 'ready',
  },
  {
    id: 'rep_003',
    title: 'User Journey Coverage Heatmap',
    type: 'coverage',
    generatedAt: 'Just now',
    score: 76,
    status: 'generating',
  },
];
