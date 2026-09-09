import type { ApiIssue, ApiRun } from './api';

export type IssueContext = {
  projectId?: string | null;
  workerId?: string | null;
};

export type RootIssue = {
  key: string;
  rootCause: string;
  issues: ApiIssue[];
  failedTests: number;
  projectId?: string | null;
  workerId?: string | null;
};

type RootCauseAnalysisWithFingerprint = NonNullable<ApiIssue['rootCauseAnalysis']> & {
  rootCauseKey?: string;
  symptomTestResultIds?: string[];
  symptomCount?: number;
};

function normalizeMessage(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<id>')
    .replace(/\b\d+ms\b/g, '<duration>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function deriveRoot(issue: ApiIssue): { key: string; label: string; symptomIds: string[] } {
  const analysis = issue.rootCauseAnalysis as RootCauseAnalysisWithFingerprint | null | undefined;
  const symptomIds = Array.isArray(analysis?.symptomTestResultIds)
    ? analysis!.symptomTestResultIds!
    : issue.testResultId
      ? [issue.testResultId]
      : [];

  if (analysis?.rootCauseKey) {
    return {
      key: analysis.rootCauseKey,
      label: analysis.likelyCause || 'Root cause identified by QA execution',
      symptomIds,
    };
  }

  if (analysis?.likelyCause) {
    return {
      key: `analysis:${normalizeMessage(analysis.likelyCause)}`,
      label: analysis.likelyCause,
      symptomIds,
    };
  }

  // Never use the test title as a grouping key. Test titles are symptoms, not
  // causes. Fall back to the actual execution result/description instead.
  const source = (issue.actualResult || issue.description || 'Unknown execution root cause').trim();
  const normalized = normalizeMessage(source);

  if (/invalid url|url must be|url is missing|url is malformed|failed to parse url|target url/.test(normalized)) {
    return {
      key: 'target-url-propagation',
      label: 'The canonical target URL was missing or malformed before browser navigation.',
      symptomIds,
    };
  }

  const assertion = normalized.match(/assertion failed:\s*([a-z0-9_-]+)/i);
  if (assertion) {
    return { key: `assertion:${assertion[1]}:${normalized}`, label: source, symptomIds };
  }

  return { key: `execution:${normalized}`, label: source, symptomIds };
}

export function buildIssueContexts(runs: ApiRun[]): Record<string, IssueContext> {
  const contexts: Record<string, IssueContext> = {};
  for (const run of runs) {
    const activeWorker = run.browserSessions?.find((session) => session.status === 'active')
      || run.browserSessions?.[0];
    contexts[run.id] = {
      projectId: run.task?.project?.id || run.task?.projectId || null,
      workerId: activeWorker?.id || null,
    };
  }
  return contexts;
}

export function groupRootIssues(
  issues: ApiIssue[],
  contexts: Record<string, IssueContext> = {},
): RootIssue[] {
  const map = new Map<string, RootIssue & { symptomIds: Set<string> }>();

  for (const issue of issues) {
    const root = deriveRoot(issue);
    const context = contexts[issue.runId] || {};
    const projectScope = context.projectId || `run:${issue.runId}`;
    const workerScope = issue.browserSessionId || context.workerId || 'run';
    const key = `${projectScope}|${workerScope}|${root.key}`;

    const group = map.get(key) || {
      key,
      rootCause: root.label,
      issues: [],
      failedTests: 0,
      projectId: context.projectId || null,
      workerId: issue.browserSessionId || context.workerId || null,
      symptomIds: new Set<string>(),
    };

    group.issues.push(issue);
    for (const symptomId of root.symptomIds) group.symptomIds.add(symptomId);
    map.set(key, group);
  }

  return [...map.values()].map(({ symptomIds, ...group }) => ({
    ...group,
    failedTests: symptomIds.size,
  }));
}
