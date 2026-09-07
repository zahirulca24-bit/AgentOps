import { describe, it, expect, vi, afterEach } from 'vitest';
import { PreviewDeploymentService } from '../../src/modules/deployment/deployment.service.js';
import { RenderDeploymentProvider } from '../../src/modules/deployment/providers/render-provider.js';
import { VercelDeploymentProvider } from '../../src/modules/deployment/providers/vercel-provider.js';
import { AppError } from '../../src/core/errors.js';

afterEach(() => vi.unstubAllGlobals());

describe('Phase 3.1 — Preview Deployment Service (Unit Tests)', () => {
  const service = new PreviewDeploymentService();

  it('blocks production branches', () => {
    expect(() => service.validateTaskBranchPolicy('main')).toThrowError(AppError);
    expect(() => service.validateTaskBranchPolicy('production')).toThrowError(AppError);
  });

  it('allows feature/task branches', () => {
    expect(() => service.validateTaskBranchPolicy('feat/add-login')).not.toThrow();
  });

  it('uses the real Render preview API for image-backed services', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'srv-preview-1',
      status: 'ready',
      serviceDetails: { url: 'https://preview.onrender.com' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const result = await new RenderDeploymentProvider().createPreviewDeployment({
      provider: 'render',
      branchName: 'feat/render-preview',
      apiToken: 'render-secret',
      serviceId: 'srv-base',
      imageUrl: 'docker.io/example/app:abc123',
    });

    expect(result.status).toBe('ready');
    expect(result.previewUrl).toBe('https://preview.onrender.com');
    expect(JSON.stringify(result)).not.toContain('render-secret');
  });

  it('does not fake Git-backed Render preview success', async () => {
    await expect(new RenderDeploymentProvider().createPreviewDeployment({
      provider: 'render',
      branchName: 'feat/git-preview',
      apiToken: 'render-secret',
      serviceId: 'srv-base',
    })).rejects.toThrow('image-backed services');
  });

  it('uses the real Vercel deployment API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'dpl_123',
      readyState: 'READY',
      url: 'agentops-git-preview.vercel.app',
      createdAt: Date.now(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const result = await new VercelDeploymentProvider().createPreviewDeployment({
      provider: 'vercel',
      branchName: 'feat/git-preview',
      repoOwner: 'zahirulca24-bit',
      repoName: 'AgentOps',
      apiToken: 'vercel-secret',
      projectId: 'prj_123',
    });

    expect(result.status).toBe('ready');
    expect(result.previewUrl).toBe('https://agentops-git-preview.vercel.app');
    expect(JSON.stringify(result)).not.toContain('vercel-secret');
  });

  it('keeps simulated failure explicit and secret-safe', async () => {
    const result = await service.createPreviewDeployment({
      provider: 'vercel',
      branchName: 'feat/failure',
      simulateFailure: true,
      apiToken: 'secret-token',
    });
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });
});
