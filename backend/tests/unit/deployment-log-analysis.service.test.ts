import { describe, it, expect } from 'vitest';
import { DeploymentLogCollector, DeploymentLogAnalyzer } from '../../src/modules/deployment/deployment-log-analyzer.js';
import { PreviewDeploymentService } from '../../src/modules/deployment/deployment.service.js';

describe('Phase 3.2 — Deployment Log Analysis (Unit Tests)', () => {
  describe('DeploymentLogCollector & Credential Redaction', () => {
    it('collects raw build logs and redacts secret tokens, api keys, and bearer tokens', () => {
      const rawLogs = `
[BUILD LOGS] Starting build for branch 'agentops/task-202'...
Secret Token: ghp_1234567890abcdef1234567890abcdef123456
Authorization: Bearer my_secret_bearer_token_xyz
DB_URL: postgresql://admin:super_secret_db_pass@db.internal:5432/appdb
api_key: secret_api_key_value
Build completed.
`;
      const cleanLogs = DeploymentLogCollector.collectAndRedact(rawLogs);

      expect(cleanLogs).not.toContain('ghp_1234567890abcdef');
      expect(cleanLogs).not.toContain('my_secret_bearer_token_xyz');
      expect(cleanLogs).not.toContain('super_secret_db_pass');
      expect(cleanLogs).not.toContain('secret_api_key_value');
      expect(cleanLogs).toContain('[REDACTED');
    });
  });

  describe('DeploymentLogAnalyzer — Error Detection & Classification', () => {
    const analyzer = new DeploymentLogAnalyzer();

    it('detects MISSING_DEPENDENCY build errors and classifies severity as HIGH', async () => {
      const logs = `
[BUILD LOGS] Installing packages...
Error: Cannot find module 'express'
npm ERR! missing: react@18.2.0, required by my-app
Command 'npm run build' exited with code 1.
`;
      const analysis = await analyzer.analyzeLogs(logs, { branchName: 'feat/missing-deps' });

      expect(analysis.outcome).toBe('FAIL');
      expect(analysis.overallSeverity).toBe('HIGH');
      expect(analysis.detectedErrors.length).toBeGreaterThan(0);
      expect(analysis.detectedErrors[0].category).toBe('MISSING_DEPENDENCY');
      expect(analysis.rootCause).toContain('MISSING_DEPENDENCY');
      expect(analysis.recommendation).toContain('package.json');
    });

    it('detects COMPILATION_FAILURE build errors and classifies severity as HIGH', async () => {
      const logs = `
src/index.ts(12,5): error TS2307: Cannot find module './missing-file' or its corresponding type declarations.
TypeScript compiler failed with 1 error.
`;
      const analysis = await analyzer.analyzeLogs(logs, { branchName: 'feat/ts-fail' });

      expect(analysis.outcome).toBe('FAIL');
      expect(analysis.overallSeverity).toBe('HIGH');
      expect(analysis.detectedErrors.some((e) => e.category === 'COMPILATION_FAILURE')).toBe(true);
      expect(analysis.rootCause).toBeDefined();
    });

    it('detects DATABASE_CONNECTION_REFUSED runtime errors and classifies severity as CRITICAL', async () => {
      const logs = `
[RUNTIME LOGS] Starting application server...
Error: ECONNREFUSED 127.0.0.1:5432
PostgresError: Connection failure to database host
Application crashed on startup.
`;
      const analysis = await analyzer.analyzeLogs(logs, { branchName: 'feat/db-crash' });

      expect(analysis.outcome).toBe('FAIL');
      expect(analysis.overallSeverity).toBe('CRITICAL');
      expect(analysis.detectedErrors.some((e) => e.category === 'DATABASE_CONNECTION_REFUSED')).toBe(true);
      expect(analysis.recommendation).toContain('database');
    });

    it('detects OUT_OF_MEMORY runtime errors and classifies severity as CRITICAL', async () => {
      const logs = `
<--- Last few GCs --->
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
`;
      const analysis = await analyzer.analyzeLogs(logs, { branchName: 'feat/oom' });

      expect(analysis.outcome).toBe('FAIL');
      expect(analysis.overallSeverity).toBe('CRITICAL');
      expect(analysis.detectedErrors.some((e) => e.category === 'OUT_OF_MEMORY')).toBe(true);
    });

    it('analyzes clean successful build logs as PASS with INFO severity', async () => {
      const logs = `
[BUILD LOGS] Render Service initialized.
[1/3] Cloning repository branch 'agentops/task-300'...
[2/3] Building container image...
[3/3] Preview deployment ready at https://agentops-task-300.onrender.com
`;
      const analysis = await analyzer.analyzeLogs(logs, { branchName: 'agentops/task-300' });

      expect(analysis.outcome).toBe('PASS');
      expect(analysis.overallSeverity).toBe('INFO');
      expect(analysis.detectedErrors).toHaveLength(0);
      expect(analysis.rootCause).toContain('No deployment build or runtime errors detected');
    });
  });

  describe('PreviewDeploymentService Integration with Log Analysis & QA Run Linkage', () => {
    const service = new PreviewDeploymentService();

    it('attaches runId and logAnalysis result when triggering preview deployment', async () => {
      const mockRunId = '550e8400-e29b-41d4-a716-446655440000';
      const result = await service.createPreviewDeployment({
        provider: 'render',
        branchName: 'agentops/task-qa-401',
        runId: mockRunId,
        apiToken: 'secret_token_123',
      });

      expect(result.runId).toBe(mockRunId);
      expect(result.status).toBe('ready');
      expect(result.logAnalysis).toBeDefined();
      expect(result.logAnalysis.outcome).toBe('PASS');
    });

    it('handles simulated build failure and attaches detailed log analysis findings', async () => {
      const mockRunId = '550e8400-e29b-41d4-a716-446655440001';
      const result = await service.createPreviewDeployment({
        provider: 'render',
        branchName: 'agentops/task-broken-500',
        runId: mockRunId,
        simulateFailure: true,
        apiToken: 'secret_token_999',
      });

      expect(result.status).toBe('failed');
      expect(result.runId).toBe(mockRunId);
      expect(result.logAnalysis).toBeDefined();
      expect(result.logAnalysis.outcome).toBe('FAIL');
      expect(result.logAnalysis.rootCause).toBeDefined();
      expect(result.logAnalysis.rootCause).not.toContain('secret_token_999');
    });
  });
});
