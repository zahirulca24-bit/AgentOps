import { describe, it, expect } from 'vitest';
import { PreviewDeploymentService } from '../../src/modules/deployment/deployment.service.js';
import { RenderDeploymentProvider } from '../../src/modules/deployment/providers/render-provider.js';
import { VercelDeploymentProvider } from '../../src/modules/deployment/providers/vercel-provider.js';
import { AppError } from '../../src/core/errors.js';

describe('Phase 3.1 — Preview Deployment Service (Unit Tests)', () => {
  const service = new PreviewDeploymentService();

  describe('Branch Policy & Production Protection', () => {
    it('blocks preview deployments on default/production branch main', () => {
      expect(() => service.validateTaskBranchPolicy('main')).toThrowError(AppError);
      try {
        service.validateTaskBranchPolicy('main');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
        expect(err.message).toContain('strictly blocked');
      }
    });

    it('blocks preview deployments on master, production, and release branches', () => {
      expect(() => service.validateTaskBranchPolicy('master')).toThrowError(AppError);
      expect(() => service.validateTaskBranchPolicy('production')).toThrowError(AppError);
      expect(() => service.validateTaskBranchPolicy('release')).toThrowError(AppError);
    });

    it('allows preview deployments on feature/task branches and PRs', () => {
      expect(() => service.validateTaskBranchPolicy('agentops/task-101')).not.toThrow();
      expect(() => service.validateTaskBranchPolicy('feat/add-login-button')).not.toThrow();
      expect(() => service.validateTaskBranchPolicy('pr-42')).not.toThrow();
    });
  });

  describe('Render Deployment Provider', () => {
    const renderProvider = new RenderDeploymentProvider();

    it('creates a ready preview deployment for task branch', async () => {
      const result = await renderProvider.createPreviewDeployment({
        provider: 'render',
        branchName: 'agentops/task-201',
        repoOwner: 'zahirulca24-bit',
        repoName: 'AgentOps',
        apiToken: 'rnd_secret_token_12345',
      });

      expect(result.provider).toBe('render');
      expect(result.status).toBe('ready');
      expect(result.previewUrl).toContain('agentops-agentops-task-201.onrender.com');
      expect(result.deploymentId).toBeDefined();
      expect(result.buildLogs).toBeDefined();
      expect(result.buildLogs).not.toContain('rnd_secret_token_12345');
    });

    it('handles simulated build failure cleanly', async () => {
      const result = await renderProvider.createPreviewDeployment({
        provider: 'render',
        branchName: 'feat/buggy-code',
        simulateFailure: true,
        apiToken: 'secret_render_token',
      });

      expect(result.status).toBe('failed');
      expect(result.previewUrl).toBeNull();
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails).not.toContain('secret_render_token');
    });
  });

  describe('Vercel Deployment Provider', () => {
    const vercelProvider = new VercelDeploymentProvider();

    it('creates a ready preview deployment for task branch', async () => {
      const result = await vercelProvider.createPreviewDeployment({
        provider: 'vercel',
        branchName: 'feat/checkout-fix',
        repoOwner: 'zahirulca24-bit',
        repoName: 'AgentOps',
        apiToken: 'vercel_secret_token_67890',
      });

      expect(result.provider).toBe('vercel');
      expect(result.status).toBe('ready');
      expect(result.previewUrl).toContain('agentops-feat-checkout-fix.vercel.app');
      expect(result.buildLogs).not.toContain('vercel_secret_token_67890');
    });

    it('handles simulated deployment failure cleanly', async () => {
      const result = await vercelProvider.createPreviewDeployment({
        provider: 'vercel',
        branchName: 'feat/broken-build',
        simulateFailure: true,
      });

      expect(result.status).toBe('failed');
      expect(result.previewUrl).toBeNull();
      expect(result.errorDetails).toContain('Deployment build error');
    });
  });

  describe('PreviewDeploymentService Lifecycle & Credential Safety', () => {
    it('triggers preview deployment via service and redacts secrets', async () => {
      const result = await service.createPreviewDeployment({
        provider: 'vercel',
        branchName: 'agentops/task-305',
        apiToken: 'super_secret_bearer_token',
        environmentVars: {
          DATABASE_URL: 'postgresql://user:pass@db:5432/db',
          GEMINI_API_KEY: 'secret_gemini_key_123',
        },
      });

      expect(result.status).toBe('ready');
      expect(result.previewUrl).toBeDefined();
      expect(JSON.stringify(result)).not.toContain('super_secret_bearer_token');
      expect(JSON.stringify(result)).not.toContain('secret_gemini_key_123');
    });

    it('returns deployment status via getDeploymentStatus', async () => {
      const result = await service.getDeploymentStatus('dpl_12345', {
        provider: 'render',
        branchName: 'feat/nav-bar',
      });

      expect(result.provider).toBe('render');
      expect(result.status).toBe('ready');
      expect(result.previewUrl).toContain('agentops-feat-nav-bar.onrender.com');
    });
  });
});
