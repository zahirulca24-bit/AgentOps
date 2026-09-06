import { describe, it, expect } from 'vitest';

export interface PipelineStep {
  id: 'plan' | 'explore' | 'generate' | 'execute' | 'evidence' | 'issues' | 'report';
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  details?: string;
}

export function computePipelineSteps(runStatus: string, testResultsCount: number, passedCount: number, failedCount: number, issuesCount: number, evidenceCount: number): PipelineStep[] {
  const isCompleted = runStatus === 'passed' || runStatus === 'completed';
  const isFailed = runStatus === 'failed' || runStatus === 'error' || runStatus === 'aborted';
  const isRunning = runStatus === 'running' || runStatus === 'pending';

  let executeStatus: 'pending' | 'running' | 'passed' | 'failed' = isCompleted ? (failedCount > 0 ? 'failed' : 'passed') : isRunning ? 'running' : 'failed';
  let evidenceStatus: 'pending' | 'running' | 'passed' | 'failed' = isCompleted ? 'passed' : isRunning ? (evidenceCount > 0 ? 'running' : 'pending') : (evidenceCount > 0 ? 'passed' : 'failed');
  let issuesStatus: 'pending' | 'running' | 'passed' | 'failed' = isCompleted ? 'passed' : isRunning ? (issuesCount > 0 ? 'running' : 'pending') : (issuesCount > 0 ? 'passed' : 'failed');
  let reportStatus: 'pending' | 'running' | 'passed' | 'failed' = isCompleted ? 'passed' : isRunning ? 'running' : 'failed';

  return [
    { id: 'plan', name: 'Plan', description: 'QA Strategy & Scope', status: 'passed' },
    { id: 'explore', name: 'Explore', description: 'Route & DOM Discovery', status: 'passed' },
    { id: 'generate', name: 'Generate Tests', description: 'Test Case Synthesis', status: 'passed' },
    { id: 'execute', name: 'Execute', description: 'Browser QA Execution', status: executeStatus, details: `${testResultsCount} tests` },
    { id: 'evidence', name: 'Evidence', description: 'Screenshots & Log Store', status: evidenceStatus, details: `${evidenceCount} evidence artifacts` },
    { id: 'issues', name: 'Issues', description: 'Defect Classification', status: issuesStatus, details: `${issuesCount} issues` },
    { id: 'report', name: 'Report', description: 'Summary & Audit Log', status: reportStatus },
  ];
}

describe('AI Automation 7-Step Pipeline Logic', () => {
  it('computes all 7 pipeline steps for completed run', () => {
    const steps = computePipelineSteps('passed', 5, 5, 0, 0, 2);
    expect(steps).toHaveLength(7);
    expect(steps.map(s => s.id)).toEqual(['plan', 'explore', 'generate', 'execute', 'evidence', 'issues', 'report']);
    expect(steps.every(s => s.status === 'passed')).toBe(true);
  });

  it('computes running status for active execution run', () => {
    const steps = computePipelineSteps('running', 3, 1, 0, 1, 1);
    expect(steps.find(s => s.id === 'execute')?.status).toBe('running');
    expect(steps.find(s => s.id === 'report')?.status).toBe('running');
  });

  it('computes failed status when test executions fail', () => {
    const steps = computePipelineSteps('failed', 2, 0, 2, 2, 2);
    expect(steps.find(s => s.id === 'execute')?.status).toBe('failed');
    expect(steps.find(s => s.id === 'report')?.status).toBe('failed');
  });
});
