import { describe, it, expect } from 'vitest';

export interface ReportHeaderData {
  appName: string;
  targetUrl: string;
  testDate: string;
  day: string;
  startTime: string;
  endTime: string;
  totalDuration: string;
  runId: string;
  environment: string;
  finalStatus: 'PASS' | 'FAIL' | 'DEGRADED';
}

export interface ReportMetricsData {
  passedCount: number;
  failedCount: number;
  issuesCount: number;
  evidenceCount: number;
  consoleErrorsCount: number;
  networkErrorsCount: number;
}

export function computeReportHeader(run: any): ReportHeaderData {
  const startedDate = new Date(run.startedAt || '2026-09-06T16:00:00Z');
  const endDate = run.completedAt ? new Date(run.completedAt) : null;

  const testDate = startedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const day = startedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const startTime = startedDate.toLocaleTimeString('en-US', { hour12: false });
  const endTime = endDate ? endDate.toLocaleTimeString('en-US', { hour12: false }) : 'In Progress';

  const diffSec = endDate ? Math.max(0, Math.round((endDate.getTime() - startedDate.getTime()) / 1000)) : 0;
  const totalDuration = diffSec < 60 ? `${diffSec}s` : `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;

  const failedCount = run.testResults?.filter((r: any) => ['failed', 'error'].includes(r.status)).length || 0;
  const issuesCount = run.issues?.length || 0;

  let finalStatus: 'PASS' | 'FAIL' | 'DEGRADED' = 'PASS';
  if (run.status === 'failed' || run.status === 'error' || run.status === 'aborted' || failedCount > 0) {
    finalStatus = 'FAIL';
  } else if (run.status === 'stopped' || issuesCount > 0) {
    finalStatus = 'DEGRADED';
  }

  return {
    appName: run.task?.project?.name || 'AgentOps Autonomous QA',
    targetUrl: run.task?.targetUrl || run.task?.project?.targetUrl || 'http://localhost:3000',
    testDate,
    day,
    startTime,
    endTime,
    totalDuration,
    runId: run.id,
    environment: 'test',
    finalStatus,
  };
}

export function computeReportMetrics(run: any): ReportMetricsData {
  const results = run.testResults || [];
  const passedCount = results.filter((r: any) => r.status === 'passed').length;
  const failedCount = results.filter((r: any) => ['failed', 'error'].includes(r.status)).length;
  const issuesCount = run.issues?.length || 0;
  const evidenceCount = run.evidence?.length || 0;

  const consoleErrorsCount = run.evidence?.filter((e: any) => e.type === 'console_log').length || 0;
  const networkErrorsCount = run.evidence?.filter((e: any) => e.type === 'network_log').length || 0;

  return {
    passedCount,
    failedCount,
    issuesCount,
    evidenceCount,
    consoleErrorsCount,
    networkErrorsCount,
  };
}

describe('QA Report Header & Metrics Logic', () => {
  it('formats all required QA report header fields from real run data', () => {
    const mockRun = {
      id: 'run-uuid-12345',
      status: 'completed',
      startedAt: '2026-09-06T16:00:00Z',
      completedAt: '2026-09-06T16:01:15Z',
      task: {
        targetUrl: 'https://example.com/checkout',
        project: {
          name: 'E-Commerce Frontend Project',
        },
      },
      testResults: [
        { id: '1', status: 'passed' },
        { id: '2', status: 'passed' },
      ],
    };

    const header = computeReportHeader(mockRun);
    expect(header.appName).toBe('E-Commerce Frontend Project');
    expect(header.targetUrl).toBe('https://example.com/checkout');
    expect(header.runId).toBe('run-uuid-12345');
    expect(header.totalDuration).toBe('1m 15s');
    expect(header.finalStatus).toBe('PASS');
  });

  it('computes breakdown metrics for passed, failed, issues, evidence, console, and network errors', () => {
    const mockRun = {
      id: 'run-uuid-67890',
      status: 'failed',
      testResults: [
        { id: '1', status: 'passed' },
        { id: '2', status: 'failed' },
      ],
      issues: [{ id: 'iss-1', title: 'Network failure on submit' }],
      evidence: [
        { id: 'ev-1', type: 'screenshot' },
        { id: 'ev-2', type: 'console_log' },
        { id: 'ev-3', type: 'network_log' },
      ],
    };

    const metrics = computeReportMetrics(mockRun);
    expect(metrics.passedCount).toBe(1);
    expect(metrics.failedCount).toBe(1);
    expect(metrics.issuesCount).toBe(1);
    expect(metrics.evidenceCount).toBe(3);
    expect(metrics.consoleErrorsCount).toBe(1);
    expect(metrics.networkErrorsCount).toBe(1);
  });
});
