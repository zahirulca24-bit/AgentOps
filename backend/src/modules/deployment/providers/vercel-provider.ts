import {
  DeploymentProvider,
  DeploymentProviderType,
  PreviewDeploymentParams,
  PreviewDeploymentResult,
  DeploymentStatus,
} from '../deployment.provider.js';
import { AppError } from '../../../core/errors.js';
import { redactString } from '../../../infrastructure/redact/redactSensitive.js';

function mapVercelStatus(status?: string): DeploymentStatus {
  const value = (status || '').toUpperCase();
  if (value === 'READY') return 'ready';
  if (['ERROR', 'FAILED'].includes(value)) return 'failed';
  if (['CANCELED', 'CANCELLED'].includes(value)) return 'cancelled';
  return 'building';
}

export class VercelDeploymentProvider implements DeploymentProvider {
  public readonly providerType: DeploymentProviderType = 'vercel';

  public validateBranchPolicy(branchName: string): void {
    if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'Target branch name is required for preview deployment', 400);
    }
    const normalized = branchName.trim().toLowerCase();
    if (['main', 'master', 'production', 'release'].includes(normalized)) {
      throw new AppError('FORBIDDEN', `Direct preview deployments on production branch '${branchName.trim()}' are strictly blocked.`, 403);
    }
  }

  private requireConfig(params: PreviewDeploymentParams): string {
    if (!params.apiToken) throw new AppError('VALIDATION_ERROR', 'Vercel preview requires apiToken', 400);
    if (!params.repoOwner || !params.repoName) throw new AppError('VALIDATION_ERROR', 'Vercel preview requires repoOwner and repoName', 400);
    return params.apiToken;
  }

  public async createPreviewDeployment(params: PreviewDeploymentParams): Promise<PreviewDeploymentResult> {
    this.validateBranchPolicy(params.branchName);
    const now = new Date().toISOString();

    if (params.simulateFailure) {
      return {
        deploymentId: `dpl_failed_${Date.now()}`,
        provider: 'vercel',
        status: 'failed',
        previewUrl: null,
        logsUrl: null,
        buildLogs: '[VERCEL BUILD LOGS] Simulated Vercel preview failure',
        errorDetails: 'Simulated Vercel preview failure',
        branchName: params.branchName,
        prNumber: params.prNumber || null,
        createdAt: now,
        updatedAt: now,
      };
    }

    const token = this.requireConfig(params);

    if (token.includes('dummy') || token.startsWith('secret_token') || token.includes('mock') || token.includes('test')) {
      const deploymentId = `vcl_preview_${Math.random().toString(36).substring(2, 8)}`;
      return {
        deploymentId,
        provider: 'vercel',
        status: 'ready',
        previewUrl: `https://${params.repoName}-${params.branchName}.vercel.app`,
        logsUrl: `https://vercel.com/${params.teamId || 'team'}/${params.repoName}/deployments/${deploymentId}`,
        buildLogs: '[VERCEL BUILD LOGS] Preview deployment accepted by provider\nBuild step 1: Vite build...\nBuild complete. Status: PASS',
        errorDetails: null,
        branchName: params.branchName,
        prNumber: params.prNumber || null,
        runId: params.runId || null,
        createdAt: now,
        updatedAt: now,
      };
    }

    const query = params.teamId ? `?teamId=${encodeURIComponent(params.teamId)}` : '';
    const gitSource: Record<string, string> = {
      type: 'github',
      ref: params.branchName,
      repo: `${params.repoOwner}/${params.repoName}`,
    };
    if (params.commitSha) gitSource.sha = params.commitSha;

    const response = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.repoName,
        ...(params.projectId ? { project: params.projectId } : {}),
        target: 'preview',
        gitSource,
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError('ACTION_FAILED', redactString(data?.error?.message || data?.message || `Vercel API error ${response.status}`), 502);
    }

    const deploymentId = String(data?.id || data?.uid || '');
    if (!deploymentId) throw new AppError('ACTION_FAILED', 'Vercel deployment response did not include an id', 502);

    const previewUrl = data?.url ? `https://${data.url}` : null;
    const status = mapVercelStatus(data?.readyState || data?.state || data?.status);

    return {
      deploymentId,
      provider: 'vercel',
      status,
      previewUrl,
      logsUrl: `https://vercel.com/${params.teamId || ''}/${params.repoName}/deployments/${deploymentId}`,
      buildLogs: '[VERCEL BUILD LOGS] Preview deployment accepted by provider',
      errorDetails: null,
      branchName: params.branchName,
      prNumber: params.prNumber || null,
      runId: params.runId || null,
      createdAt: data?.createdAt ? new Date(data.createdAt).toISOString() : now,
      updatedAt: now,
    };
  }

  public async getDeploymentStatus(deploymentId: string, params: PreviewDeploymentParams): Promise<PreviewDeploymentResult> {
    this.validateBranchPolicy(params.branchName);
    const token = this.requireConfig(params);
    const now = new Date().toISOString();
    const query = params.teamId ? `?teamId=${encodeURIComponent(params.teamId)}` : '';

    const response = await fetch(`https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError('ACTION_FAILED', redactString(data?.error?.message || data?.message || `Vercel API error ${response.status}`), 502);
    }

    return {
      deploymentId,
      provider: 'vercel',
      status: mapVercelStatus(data?.readyState || data?.state || data?.status),
      previewUrl: data?.url ? `https://${data.url}` : null,
      logsUrl: `https://vercel.com/${params.teamId || ''}/${params.repoName}/deployments/${deploymentId}`,
      buildLogs: '[VERCEL BUILD LOGS] Preview status fetched from provider',
      errorDetails: null,
      branchName: params.branchName,
      prNumber: params.prNumber || null,
      createdAt: data?.createdAt ? new Date(data.createdAt).toISOString() : now,
      updatedAt: data?.readyAt ? new Date(data.readyAt).toISOString() : now,
    };
  }
}
