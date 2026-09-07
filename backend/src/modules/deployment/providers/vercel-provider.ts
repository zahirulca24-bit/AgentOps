import {
  DeploymentProvider,
  DeploymentProviderType,
  PreviewDeploymentParams,
  PreviewDeploymentResult,
} from '../deployment.provider.js';
import { AppError } from '../../../core/errors.js';
import { redactString } from '../../../infrastructure/redact/redactSensitive.js';

export class VercelDeploymentProvider implements DeploymentProvider {
  public readonly providerType: DeploymentProviderType = 'vercel';

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
    const deploymentId = `dpl_${Math.random().toString(36).substring(2, 12)}`;

    if (params.simulateFailure) {
      const errorMsg = redactString(`[Vercel Provider] Deployment build error on branch '${params.branchName}': Command 'next build' exited with status 1. Token: ${params.apiToken || 'N/A'}`);
      return {
        deploymentId,
        provider: 'vercel',
        status: 'failed',
        previewUrl: null,
        logsUrl: `https://vercel.com/logs/${deploymentId}`,
        buildLogs: redactString(`[VERCEL BUILD LOGS] Cloning repository branch '${params.branchName}'...\nRunning build command...\nError: Compilation failed.\n${errorMsg}`),
        errorDetails: errorMsg,
        branchName: params.branchName,
        prNumber: params.prNumber || null,
        createdAt: now,
        updatedAt: now,
      };
    }

    const previewUrl = `https://agentops-${branchSlug}.vercel.app`;
    const buildLogs = redactString(`[VERCEL BUILD LOGS] Vercel Preview Deployment initialized for branch '${params.branchName}'.\n[1/3] Fetching branch metadata...\n[2/3] Building static assets...\n[3/3] Deployed to ${previewUrl}`);

    return {
      deploymentId,
      provider: 'vercel',
      status: 'ready',
      previewUrl,
      logsUrl: `https://vercel.com/logs/${deploymentId}`,
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
        provider: 'vercel',
        status: 'failed',
        previewUrl: null,
        logsUrl: `https://vercel.com/logs/${deploymentId}`,
        buildLogs: redactString(`[VERCEL BUILD LOGS] Deployment ${deploymentId} failed`),
        errorDetails: redactString(`Vercel build failed for deployment ${deploymentId}`),
        branchName: params.branchName,
        prNumber: params.prNumber || null,
        createdAt: now,
        updatedAt: now,
      };
    }

    return {
      deploymentId,
      provider: 'vercel',
      status: 'ready',
      previewUrl: `https://agentops-${branchSlug}.vercel.app`,
      logsUrl: `https://vercel.com/logs/${deploymentId}`,
      buildLogs: redactString(`[VERCEL BUILD LOGS] Vercel preview status: READY`),
      errorDetails: null,
      branchName: params.branchName,
      prNumber: params.prNumber || null,
      createdAt: now,
      updatedAt: now,
    };
  }
}
