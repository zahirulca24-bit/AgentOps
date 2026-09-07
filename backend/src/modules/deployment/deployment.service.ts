import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { previewDeployments } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactString, redactObject } from '../../infrastructure/redact/redactSensitive.js';
import {
  DeploymentProvider,
  DeploymentProviderType,
  PreviewDeploymentParams,
  PreviewDeploymentResult,
} from './deployment.provider.js';
import { RenderDeploymentProvider } from './providers/render-provider.js';
import { VercelDeploymentProvider } from './providers/vercel-provider.js';

export class PreviewDeploymentService {
  private providers = new Map<DeploymentProviderType, DeploymentProvider>();

  constructor(private db?: Database) {
    const renderProvider = new RenderDeploymentProvider();
    const vercelProvider = new VercelDeploymentProvider();

    this.providers.set('render', renderProvider);
    this.providers.set('vercel', vercelProvider);
  }

  public validateTaskBranchPolicy(branchName: string, defaultBranch: string = 'main'): void {
    if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'Target branch name is required for preview deployment', 400);
    }

    const trimmed = branchName.trim();
    const normalizedTarget = trimmed.toLowerCase();
    const normalizedDefault = defaultBranch.toLowerCase();

    if (normalizedTarget === normalizedDefault || ['main', 'master', 'production', 'release'].includes(normalizedTarget)) {
      throw new AppError(
        'FORBIDDEN',
        `Direct preview deployments on production branch '${trimmed}' are strictly blocked. Every preview deployment must target a task/feature branch (e.g. agentops/task-101) or PR.`,
        403
      );
    }
  }

  public getProvider(providerType: DeploymentProviderType): DeploymentProvider {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new AppError('VALIDATION_ERROR', `Unsupported deployment provider: '${providerType}'. Supported providers are 'render' and 'vercel'.`, 400);
    }
    return provider;
  }

  public async createPreviewDeployment(input: PreviewDeploymentParams): Promise<PreviewDeploymentResult> {
    // 1. Enforce Task Branch Policy (Block Production Deployments)
    this.validateTaskBranchPolicy(input.branchName);

    // 2. Select Provider
    const provider = this.getProvider(input.provider);

    // 3. Sanitize Secrets in Input Context
    const safeInput = redactObject(input);

    let result: PreviewDeploymentResult;

    try {
      // 4. Trigger Preview Deployment via Provider
      result = await provider.createPreviewDeployment(input);
    } catch (err: any) {
      // Clean error handling for failed deployments without crashing app
      const safeErrorMsg = redactString(err?.message || 'Deployment execution failed');
      const now = new Date().toISOString();

      result = {
        deploymentId: `failed_dpl_${Date.now()}`,
        provider: input.provider,
        status: 'failed',
        previewUrl: null,
        logsUrl: null,
        buildLogs: redactString(`[BUILD LOGS] Deployment failed to initialize: ${safeErrorMsg}`),
        errorDetails: safeErrorMsg,
        branchName: input.branchName,
        prNumber: input.prNumber || null,
        createdAt: now,
        updatedAt: now,
      };
    }

    // 5. Redact Secrets from Output & Logs
    const safeResult: PreviewDeploymentResult = {
      ...result,
      buildLogs: result.buildLogs ? redactString(result.buildLogs) : undefined,
      errorDetails: result.errorDetails ? redactString(result.errorDetails) : null,
    };

    // 6. Persist Deployment Record to Database if DB client exists
    if (this.db) {
      try {
        await this.db.insert(previewDeployments).values({
          provider: safeResult.provider,
          branchName: safeResult.branchName,
          prNumber: safeResult.prNumber || null,
          status: safeResult.status,
          previewUrl: safeResult.previewUrl || null,
          logsUrl: safeResult.logsUrl || null,
          buildLogs: safeResult.buildLogs || null,
          errorDetails: safeResult.errorDetails || null,
        });
      } catch {
        // Ignore DB insert failure in test/mock environments
      }
    }

    return safeResult;
  }

  public async getDeploymentStatus(
    deploymentId: string,
    input: PreviewDeploymentParams
  ): Promise<PreviewDeploymentResult> {
    this.validateTaskBranchPolicy(input.branchName);
    const provider = this.getProvider(input.provider);

    try {
      const result = await provider.getDeploymentStatus(deploymentId, input);
      return {
        ...result,
        buildLogs: result.buildLogs ? redactString(result.buildLogs) : undefined,
        errorDetails: result.errorDetails ? redactString(result.errorDetails) : null,
      };
    } catch (err: any) {
      const safeErrorMsg = redactString(err?.message || 'Failed to fetch deployment status');
      const now = new Date().toISOString();

      return {
        deploymentId,
        provider: input.provider,
        status: 'failed',
        previewUrl: null,
        logsUrl: null,
        buildLogs: redactString(`[BUILD LOGS] Status check failed: ${safeErrorMsg}`),
        errorDetails: safeErrorMsg,
        branchName: input.branchName,
        prNumber: input.prNumber || null,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  public async listDeployments(): Promise<PreviewDeploymentResult[]> {
    if (!this.db) return [];

    try {
      const records = await this.db.select().from(previewDeployments).orderBy(desc(previewDeployments.createdAt));
      return records.map((r: any) => ({
        deploymentId: r.id,
        provider: r.provider as DeploymentProviderType,
        status: r.status as any,
        previewUrl: r.previewUrl,
        logsUrl: r.logsUrl,
        buildLogs: r.buildLogs ? redactString(r.buildLogs) : undefined,
        errorDetails: r.errorDetails ? redactString(r.errorDetails) : null,
        branchName: r.branchName,
        prNumber: r.prNumber,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }
}
