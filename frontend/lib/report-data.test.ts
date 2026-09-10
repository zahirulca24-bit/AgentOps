import { describe, expect, it } from 'vitest';
import { extractTargetUrl, formatReportData } from './report-data';

describe('report data', () => {
  it('uses only real backend target context and successful run evidence', () => {
    const run = {
      id: 'r1',
      taskId: 't1',
      status: 'passed',
      startedAt: '2026-09-10T00:00:00.000Z',
      completedAt: '2026-09-10T00:00:05.000Z',
      createdAt: '2026-09-10T00:00:00.000Z',
      task: {
        id: 't1',
        projectId: 'p1',
        command: 'verify the dashboard',
        targetUrl: 'https://example.com/dashboard',
        status: 'completed',
        project: { id: 'p1', name: 'Example', targetUrl: 'https://example.com', createdAt: '' },
      },
      testResults: [{ id: 'tr1', runId: 'r1', name: 'loads', status: 'passed', createdAt: '' }],
      issues: [],
      evidence: [{ id: 'e1', runId: 'r1', type: 'run_report', storageRef: 'report-ref', createdAt: '' }],
      browserSessions: [{ id: 'w1', runId: 'r1', status: 'closed', startedAt: '', createdAt: '' }],
    } as any;

    const report = formatReportData(run);
    expect(extractTargetUrl(run)).toBe('https://example.com/dashboard');
    expect(report.targetUrl).toBe('https://example.com/dashboard');
    expect(report.finalStatus).toBe('PASS');
    expect(report.passedCount).toBe(1);
    expect(report.evidenceCount).toBe(1);
    expect(report.issuesCount).toBe(0);
  });

  it('counts root issues instead of duplicate raw symptoms', () => {
    const rootCauseAnalysis = {
      rootCauseKey: 'target-url-propagation',
      likelyCause: 'Canonical target missing',
      confidence: 'high',
      affectedArea: 'qa',
      recommendedNextAction: 'fix target propagation',
      facts: [],
      inference: '',
    };
    const run = {
      id: 'r1', taskId: 't1', status: 'error', startedAt: '2026-09-10T00:00:00.000Z', createdAt: '2026-09-10T00:00:00.000Z',
      task: { id: 't1', projectId: 'p1', command: 'test https://example.com', status: 'failed', project: { id: 'p1', name: 'Example', createdAt: '' } },
      issues: [
        { id: 'i1', runId: 'r1', testResultId: 'tr1', title: 'One symptom', severity: 'high', status: 'open', createdAt: '', updatedAt: '', rootCauseAnalysis },
        { id: 'i2', runId: 'r1', testResultId: 'tr2', title: 'Another symptom', severity: 'high', status: 'open', createdAt: '', updatedAt: '', rootCauseAnalysis },
      ],
      testResults: [
        { id: 'tr1', runId: 'r1', name: 'a', status: 'error', createdAt: '' },
        { id: 'tr2', runId: 'r1', name: 'b', status: 'error', createdAt: '' },
      ],
      evidence: [], browserSessions: [],
    } as any;

    const report = formatReportData(run);
    expect(report.issuesCount).toBe(1);
    expect(report.failedCount).toBe(2);
    expect(report.finalStatus).toBe('FAIL');
  });

  it('does not invent a localhost target when backend context has no URL', () => {
    const run = {
      id: 'r1', taskId: 't1', status: 'passed', startedAt: '2026-09-10T00:00:00.000Z', createdAt: '2026-09-10T00:00:00.000Z',
      task: { id: 't1', projectId: 'p1', command: 'run smoke tests', status: 'completed' },
    } as any;
    expect(extractTargetUrl(run)).toBe('');
  });
});
