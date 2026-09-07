import {
  DeploymentProvider,
  DeploymentProviderType,
  PreviewDeploymentParams,
  PreviewDeploymentResult,
  DeploymentStatus,
} from '../deployment.provider.js';
import { AppError } from '../../../core/errors.js';
import { redactString } from '../../../infrastructure/redact/redactSensitive.js';

export class RenderDeploymentProvider implements DeploymentProvider {
  public readonly providerType: DeploymentProviderType = 'render';

  public validateBranchPolicy(branchName: string): void {
    if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'Target branch name is required for preview deployment', 400);
    }
    const normalized = branchName.trim().toLowerCase();
    if (['main', 'master', 'production', 'release'].includes(normalized)) {
      throw new AppError(
        'FORBIDDEN',
        `Direct preview deployments on production branch '${branchName.trim()}' are strictly blocked. Every preview deployment must target a task/feature branch or PR.`,
        403
      );
    }
  }

  public async createPreviewDeployment(params: PreviewDeploymentParams): Promise<PreviewDeploymentResult> {
    this.validateBranchPolicy(params.branchName);

    const now = new Date().toISOString();
    const branchSlug = params.branchName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const deploymentId = `rnd_dep_${Math.random().toString(36).substring(2, 10)}`;

    if (params.simulateFailure) {
      const errorMsg = redactString(`[Render Provider] Build failed for branch '${params.branchName}': Command 'npm run build' exited with code 1. Token: ${params.apiToken || 'N/A'}`);
      return {
        deploymentId,
        provider: 'render',
        status: 'failed',
        previewUrl: null,
        logsUrl: `https://dashboard.render.com/logs/${deploymentId}`,
        buildLogs: redactString(`[BUILD LOGS] Checking out branch '${params.branchName}'...\nInstalling dependencies...\nError: Build script failed.\n${errorMsg}`),
        errorDetails: errorMsg,
        branchName: params.branchName,
        prNumber: params.prNumber || null,
        createdAt: now,
        updatedAt: now,
      };
    }

    const previewUrl = `https://agentops-${branchSlug}.onrender.com`;
    const buildLogs = redactString(`[BUILD LOGS] Render Service initialized for branch '${params.branchName}'.\n[1/3] Cloning repository branch '${params.branchName}'...\n[2/3] Building container image...\n[3/3] Preview deployment ready at ${previewUrl}`);

    return {
      deploymentId,
      provider: 'render',
      status: 'ready',
      previewUrl,
      logsUrl: `https://dashboard.render.com/logs/${deploymentId}`,
      buildLogs,
      errorDetails: null,
      branchName: params.branchName,
      prNumber: params.prNumber || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  public async getDeploymentStatus(
    deploymentId: string,
    params: PreviewDeploymentParams
  ): Promise<PreviewDeploymentResult> {
    this.validateBranchPolicy(params.branchName);
    const now = new Date().toISOString();
    const branchSlug = params.branchName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    if (params.simulateFailure) {
      return {
        deploymentId,
        provider: 'render',
        status: 'failed',
        previewUrl: null,
        logsUrl: `https://dashboard.render.com/logs/${deploymentId}`,
        buildLogs: redactString(`[BUILD LOGS] Deployment ${deploymentId} failed`),
        errorDetails: redactString(`Render build failed for deployment ${deploymentId}`),
        branchName: params.branchName,
        prNumber: params.prNumber || null,
        createdAt: now,
        updatedAt: now,
      };
    }

    return {
      deploymentId,
      provider: 'render',
      status: 'ready',
      previewUrl: `https://agentops-${branchSlug}.onrender.com`,
      logsUrl: `https://dashboard.render.com/logs/${deploymentId}`,
      buildLogs: redactString(`[BUILD LOGS] Render preview status: READY`),
      errorDetails: null,
      branchName: params.branchName,
      prNumber: params.prNumber || null,
      createdAt: now,
      updatedAt: now,
    };
  }
}
