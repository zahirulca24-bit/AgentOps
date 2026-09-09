import { describe, expect, it } from 'vitest';
import { buildIssueContexts, groupRootIssues } from './issue-groups';

describe('groupRootIssues', () => {
  it('groups duplicate root causes even when test titles differ', () => {
    const groups = groupRootIssues([
      {
        id: '1', runId: 'r1', testResultId: 't1', title: 'Test Failed: Login', severity: 'high', status: 'open', createdAt: '', updatedAt: '',
        actualResult: 'Invalid URL format while opening target',
      },
      {
        id: '2', runId: 'r1', testResultId: 't2', title: 'Test Failed: Logout', severity: 'high', status: 'open', createdAt: '', updatedAt: '',
        actualResult: 'Invalid URL format while opening target',
      },
    ] as any);

    expect(groups).toHaveLength(1);
    expect(groups[0].issues).toHaveLength(2);
    expect(groups[0].failedTests).toBe(2);
    expect(groups[0].rootCause).toContain('canonical target URL');
  });

  it('uses backend root-cause fingerprints and tracked symptom ids', () => {
    const groups = groupRootIssues([
      {
        id: '1', runId: 'r1', title: 'Execution Error: Anything', severity: 'high', status: 'open', createdAt: '', updatedAt: '',
        rootCauseAnalysis: {
          rootCauseKey: 'target-url-propagation',
          likelyCause: 'Canonical target missing',
          confidence: 'high',
          affectedArea: 'qa',
          recommendedNextAction: 'fix propagation',
          facts: [],
          inference: '',
          symptomTestResultIds: ['t1', 't2', 't3'],
        },
      },
    ] as any);

    expect(groups).toHaveLength(1);
    expect(groups[0].failedTests).toBe(3);
    expect(groups[0].rootCause).toBe('Canonical target missing');
  });

  it('keeps identical causes separate across project/worker context', () => {
    const runs = [
      { id: 'r1', task: { projectId: 'p1', project: { id: 'p1' } }, browserSessions: [{ id: 'w1', status: 'closed' }] },
      { id: 'r2', task: { projectId: 'p2', project: { id: 'p2' } }, browserSessions: [{ id: 'w2', status: 'closed' }] },
    ] as any;
    const contexts = buildIssueContexts(runs);
    const groups = groupRootIssues([
      { id: '1', runId: 'r1', browserSessionId: 'w1', title: 'A', description: 'Connection reset', severity: 'high', status: 'open', createdAt: '', updatedAt: '' },
      { id: '2', runId: 'r2', browserSessionId: 'w2', title: 'B', description: 'Connection reset', severity: 'high', status: 'open', createdAt: '', updatedAt: '' },
    ] as any, contexts);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.projectId).sort()).toEqual(['p1', 'p2']);
  });
});
