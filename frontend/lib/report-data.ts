import type { ApiRun } from './api';
import { buildIssueContexts, groupRootIssues, type RootIssue } from './issue-groups';

export interface FormattedReport {
  run: ApiRun;
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
  passedCount: number;
  failedCount: number;
  issuesCount: number;
  evidenceCount: number;
  consoleErrorsCount: number;
  networkErrorsCount: number;
  rootIssues: RootIssue[];
}

export function extractTargetUrl(run: ApiRun): string {
  if (run.task?.targetUrl?.trim()) return run.task.targetUrl.trim();
  if (run.task?.project?.targetUrl?.trim()) return run.task.project.targetUrl.trim();
  if (run.task?.command) {
    const match = run.task.command.match(/https?:\/\/[^\s<>"'`\])}]+/i);
    if (match) return match[0].replace(/[.,;:!?]+$/, '');
  }
  return '';
}

export function formatReportData(run: ApiRun): FormattedReport {
  const startedDate = new Date(run.startedAt || run.createdAt);
  const endDate = run.completedAt ? new Date(run.completedAt) : null;
  const testDate = startedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const day = startedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const startTime = startedDate.toLocaleTimeString('en-US', { hour12: false });
  const endTime = endDate ? endDate.toLocaleTimeString('en-US', { hour12: false }) : 'In Progress';
  const startMs = startedDate.getTime();
  const endMs = endDate ? endDate.getTime() : Date.now();
  const diffSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const totalDuration = diffSec < 60 ? `${diffSec}s` : `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;

  const results = run.testResults || [];
  const passedCount = results.filter((result) => result.status === 'passed').length;
  const failedCount = results.filter((result) => ['failed', 'error'].includes(result.status)).length;
  const rootIssues = groupRootIssues(run.issues || [], buildIssueContexts([run]));
  const issuesCount = rootIssues.length;
  const evidenceCount = run.evidence?.length || 0;

  const consoleEvidenceCount = run.evidence?.filter((item) => item.type === 'console_log').length || 0;
  const issueConsoleCount = run.issues?.reduce((count, issue) => {
    const list = Array.isArray(issue.consoleEvidence) ? issue.consoleEvidence : [];
    return count + list.length;
  }, 0) || 0;
  const consoleErrorsCount = Math.max(consoleEvidenceCount, issueConsoleCount);

  const networkEvidenceCount = run.evidence?.filter((item) => item.type === 'network_log').length || 0;
  const issueNetworkCount = run.issues?.reduce((count, issue) => {
    const list = Array.isArray(issue.networkEvidence) ? issue.networkEvidence : [];
    return count + list.length;
  }, 0) || 0;
  const networkErrorsCount = Math.max(networkEvidenceCount, issueNetworkCount);

  let finalStatus: 'PASS' | 'FAIL' | 'DEGRADED' = 'PASS';
  if (run.status === 'failed' || run.status === 'error' || run.status === 'aborted' || failedCount > 0) {
    finalStatus = 'FAIL';
  } else if (run.status === 'stopped' || issuesCount > 0) {
    finalStatus = 'DEGRADED';
  }

  const targetUrl = extractTargetUrl(run);
  let environment = 'Backend QA';
  if (targetUrl) {
    try {
      environment = new URL(targetUrl).hostname;
    } catch {
      environment = 'Backend QA';
    }
  }

  return {
    run,
    appName: run.task?.project?.name || 'AgentOps QA Run',
    targetUrl,
    testDate,
    day,
    startTime,
    endTime,
    totalDuration,
    runId: run.id,
    environment,
    finalStatus,
    passedCount,
    failedCount,
    issuesCount,
    evidenceCount,
    consoleErrorsCount,
    networkErrorsCount,
    rootIssues,
  };
}
