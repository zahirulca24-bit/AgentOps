import { ApiRun } from '@/lib/api';

export type PipelineStepId = 'plan' | 'explore' | 'generate' | 'execute' | 'evidence' | 'issues' | 'report';
export type PipelineStepStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface PipelineStep {
  id: PipelineStepId;
  name: string;
  description: string;
  status: PipelineStepStatus;
  details?: string;
}

export interface LiveEventItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  status?: 'info' | 'running' | 'success' | 'error';
}

export function getDefaultSteps(): PipelineStep[] {
  return [
    { id: 'plan', name: 'Plan', description: 'QA Strategy & Scope', status: 'pending' },
    { id: 'explore', name: 'Explore', description: 'Route & DOM Discovery', status: 'pending' },
    { id: 'generate', name: 'Generate Tests', description: 'Test Case Synthesis', status: 'pending' },
    { id: 'execute', name: 'Execute', description: 'Browser QA Execution', status: 'pending' },
    { id: 'evidence', name: 'Evidence', description: 'Screenshots & Log Store', status: 'pending' },
    { id: 'issues', name: 'Issues', description: 'Defect Classification', status: 'pending' },
    { id: 'report', name: 'Report', description: 'Summary & Audit Log', status: 'pending' },
  ];
}

export function computePipelineData(run: ApiRun | null, events: LiveEventItem[]) {
  if (!run) {
    return {
      steps: getDefaultSteps(),
      currentAction: 'No active automation pipeline',
      progressPercent: 0,
    };
  }

  const isCompleted = run.status === 'passed' || run.status === 'completed';
  const isFailed = run.status === 'failed' || run.status === 'error' || run.status === 'aborted';
  const isStopped = run.status === 'stopped';
  const isRunning = run.status === 'running' || run.status === 'pending';

  const testResults = run.testResults || [];
  const issues = run.issues || [];
  const evidence = run.evidence || [];

  const totalTests = testResults.length;
  const completedTests = testResults.filter(t => t.status !== 'pending' && t.status !== 'running').length;
  const passedTests = testResults.filter(t => t.status === 'passed').length;
  const failedTests = testResults.filter(t => t.status === 'failed' || t.status === 'error').length;

  let planStatus: PipelineStepStatus = 'passed';
  let exploreStatus: PipelineStepStatus = 'passed';
  let generateStatus: PipelineStepStatus = 'passed';
  let executeStatus: PipelineStepStatus = 'pending';
  let evidenceStatus: PipelineStepStatus = 'pending';
  let issuesStatus: PipelineStepStatus = 'pending';
  let reportStatus: PipelineStepStatus = 'pending';

  let currentAction = 'Pipeline initialized';

  if (isRunning) {
    if (totalTests === 0) {
      executeStatus = 'running';
      currentAction = 'Generating structured test cases and initializing browser session';
    } else if (completedTests < totalTests) {
      executeStatus = 'running';
      const currentTest = testResults.find(t => t.status === 'running' || t.status === 'pending');
      currentAction = currentTest ? `Executing test: ${currentTest.name}` : `Executing test suite (${completedTests}/${totalTests} complete)`;
    } else {
      executeStatus = failedTests > 0 ? 'failed' : 'passed';
      currentAction = 'Finalizing test evidence and evaluating visual QA assertions';
    }

    if (evidence.length > 0) {
      evidenceStatus = 'running';
    }
    if (issues.length > 0) {
      issuesStatus = 'running';
    }
    reportStatus = 'running';
  } else if (isCompleted) {
    executeStatus = failedTests > 0 ? 'failed' : 'passed';
    evidenceStatus = 'passed';
    issuesStatus = 'passed';
    reportStatus = 'passed';
    currentAction = `Pipeline completed successfully (${passedTests} test(s) passed, ${issues.length} issue(s) recorded)`;
  } else if (isFailed || isStopped) {
    executeStatus = failedTests > 0 ? 'failed' : 'failed';
    evidenceStatus = evidence.length > 0 ? 'passed' : 'failed';
    issuesStatus = issues.length > 0 ? 'passed' : 'failed';
    reportStatus = 'failed';
    currentAction = `Pipeline ended with status: ${run.status}`;
  }

  const steps: PipelineStep[] = [
    { id: 'plan', name: 'Plan', description: 'QA Strategy & Scope', status: planStatus, details: 'Target command analyzed and plan generated' },
    { id: 'explore', name: 'Explore', description: 'Route & DOM Discovery', status: exploreStatus, details: 'Page structure and interactable elements mapped' },
    { id: 'generate', name: 'Generate Tests', description: 'Test Case Synthesis', status: generateStatus, details: totalTests > 0 ? `${totalTests} test case(s) generated` : 'Synthesizing test cases' },
    { id: 'execute', name: 'Execute', description: 'Browser QA Execution', status: executeStatus, details: totalTests > 0 ? `${completedTests}/${totalTests} tests complete (${passedTests} passed, ${failedTests} failed)` : 'Pending browser launch' },
    { id: 'evidence', name: 'Evidence', description: 'Screenshots & Log Store', status: evidenceStatus, details: evidence.length > 0 ? `${evidence.length} evidence artifact(s) captured` : 'Capturing screenshots & logs on failure' },
    { id: 'issues', name: 'Issues', description: 'Defect Classification', status: issuesStatus, details: issues.length > 0 ? `${issues.length} defect issue(s) created` : 'No open defects recorded' },
    { id: 'report', name: 'Report', description: 'Summary & Audit Log', status: reportStatus, details: `Final status: ${run.status}` },
  ];

  const passedStepCount = steps.filter(s => s.status === 'passed').length;
  const runningStepCount = steps.filter(s => s.status === 'running').length;
  let progressPercent = 0;

  if (isCompleted) {
    progressPercent = 100;
  } else if (isFailed || isStopped) {
    progressPercent = Math.min(95, Math.round(((passedStepCount + 0.5) / steps.length) * 100));
  } else {
    progressPercent = Math.min(95, Math.round(((passedStepCount + runningStepCount * 0.5) / steps.length) * 100));
  }

  if (events.length > 0 && isRunning) {
    const latestEvent = events[0];
    if (latestEvent.message) {
      currentAction = latestEvent.message;
    }
  }

  return {
    steps,
    currentAction,
    progressPercent,
  };
}
