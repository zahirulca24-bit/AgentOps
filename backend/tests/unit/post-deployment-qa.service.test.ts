import { describe, it, expect } from 'vitest';
import { PostDeploymentQAService } from '../../src/modules/deployment/post-deployment-qa.service.js';

describe('Phase 3.3 — Post-Deployment QA Service (Unit Tests)', () => {
  const service = new PostDeploymentQAService();

  it('triggers post-deployment QA and returns summary with PASS verdict and linked targetUrl', async () => {
    const deploymentId = 'dpl_preview_ready_101';
    const summary = await service.triggerPostDeploymentQA(deploymentId, {
      previewUrl: 'https://agentops-task-101.onrender.com',
      branchName: 'agentops/task-101',
    });

    expect(summary.deploymentId).toBe(deploymentId);
    expect(summary.targetUrl).toBe('https://agentops-task-101.onrender.com');
    expect(summary.verdict).toBe('PASS');
    expect(summary.passedTests).toBe(3);
    expect(summary.failedTests).toBe(0);
    expect(summary.runId).toBeDefined();
  });

  it('prevents duplicate QA runs for the same deploymentId unless forceReRun is true', async () => {
    const deploymentId = 'dpl_preview_ready_202';
    const firstRun = await service.triggerPostDeploymentQA(deploymentId, {
      previewUrl: 'https://agentops-task-202.onrender.com',
    });

    const secondRun = await service.triggerPostDeploymentQA(deploymentId, {
      previewUrl: 'https://agentops-task-202.onrender.com',
    });

    // Should return exact same run instance and runId (duplicate prevented)
    expect(secondRun.runId).toBe(firstRun.runId);
    expect(secondRun.startedAt).toBe(firstRun.startedAt);
  });

  it('allows force re-running post-deployment QA when forceReRun is true', async () => {
    const deploymentId = 'dpl_preview_ready_303';
    const firstRun = await service.triggerPostDeploymentQA(deploymentId);
    const secondRun = await service.triggerPostDeploymentQA(deploymentId, { forceReRun: true });

    expect(secondRun).toBeDefined();
    expect(secondRun.deploymentId).toBe(deploymentId);
  });
});
