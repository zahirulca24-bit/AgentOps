import {
  DeploymentProvider,
  DeploymentProviderType,
  PreviewDeploymentParams,
  PreviewDeploymentResult,
  DeploymentStatus,
} from '../deployment.provider.js';
import { AppError } from '../../../core/errors.js';
import { redactString } from '../../../infrastructure/redact/redactSensitive.js';

function mapRenderStatus(status?: string): DeploymentStatus {
  const value = (status || '').toLowerCase();
  if (['live', 'ready', 'succeeded'].includes(value)) return 'ready';
  if (['build_failed', 'update_failed', 'canceled', 'cancelled', 'failed'].includes(value)) return value.includes('cancel') ? 'cancelled' : 'failed';
  return 'building';
}

export class RenderDeploymentProvider implements DeploymentProvider {
  public readonly providerType: DeploymentProviderType = 'render';

  public validateBranchPolicy(branchName: string): void {
    if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'Target branch name is required for preview deployment', 400);
    }
    const normalized = branchName.trim().toLowerCase();
    if (['main', 'master', 'production', 'release'].includes(normalized)) {
      throw new AppError('FORBIDDEN', `Direct preview deployments on production branch '${branchName.trim()}' are strictly blocked.`, 403);
    }
  }

  private requireConfig(params: PreviewDeploymentParams): { token: string; serviceId: string } {
    if (!params.apiToken || !params.serviceId) {
      throw new AppError('VALIDATION_ERROR', 'Render preview requires apiToken and serviceId', 400);
    }
    return { token: params.apiToken, serviceId: params.serviceId };
  }

  public async createPreviewDeployment(params: PreviewDeploymentParams): Promise<PreviewDeploymentResult> {
    this.validateBranchPolicy(params.branchName);
    const now = new Date().toISOString();

    if (params.simulateFailure) {
      return {
        deploymentId: `rnd_failed_${Date.now()}`,
        provider: 'render',
        status: 'failed',
        previewUrl: null,
        logsUrl: null,
        buildLogs: '[BUILD LOGS] Simulated Render preview failure',
        errorDetails: 'Simulated Render preview failure',
        branchName: params.branchName,
        prNumber: params.prNumber || null,
        createdAt: now,
        updatedAt: now,
      };
    }

    const { token, serviceId } = this.requireConfig(params);
    if (!params.imageUrl) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Render API can only create service previews for image-backed services. Provide imageUrl, or use Render native PR previews for Git-backed services.',
        400
      );
    }

    const response = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        imagePath: params.imageUrl,
        name: `preview-${params.branchName.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40)}`,
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError('PROVIDER_ERROR', redactString(data?.message || data?.error || `Render API error ${response.status}`), 502);
    }

    const deploymentId = String(data?.id || data?.service?.id || data?.preview?.id || '');
    if (!deploymentId) throw new AppError('PROVIDER_ERROR', 'Render preview response did not include an id', 502);

    const previewUrl = data?.serviceDetails?.url || data?.url || data?.service?.serviceDetails?.url || null;
    const status = mapRenderStatus(data?.status || data?.service?.status);

    return {
      deploymentId,
      provider: 'render',
      status,
      previewUrl,
      logsUrl: `https://dashboard.render.com/web/${deploymentId}`,
      buildLogs: '[BUILD LOGS] Render preview creation accepted by provider',
      errorDetails: null,
      branchName: params.branchName,
      prNumber: params.prNumber || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  public async getDeploymentStatus(deploymentId: string, params: PreviewDeploymentParams): Promise<PreviewDeploymentResult> {
    this.validateBranchPolicy(params.branchName);
    const { token } = this.requireConfig(params);
    const now = new Date().toISOString();

    const response = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(deploymentId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError('PROVIDER_ERROR', redactString(data?.message || data?.error || `Render API error ${response.status}`), 502);
    }

    return {
      deploymentId,
      provider: 'render',
      status: mapRenderStatus(data?.status),
      previewUrl: data?.serviceDetails?.url || data?.url || null,
      logsUrl: `https://dashboard.render.com/web/${deploymentId}`,
      buildLogs: '[BUILD LOGS] Render preview status fetched from provider',
      errorDetails: null,
      branchName: params.branchName,
      prNumber: params.prNumber || null,
      createdAt: data?.createdAt || now,
      updatedAt: data?.updatedAt || now,
    };
  }
}
