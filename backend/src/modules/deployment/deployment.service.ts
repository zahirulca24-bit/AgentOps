import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
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
import { DeploymentLogAnalyzer } from './deployment-log-analyzer.js';
import { DeploymentLogAnalysis } from './deployment-log-analysis.schema.js';
import { PostDeploymentQAService } from './post-deployment-qa.service.js';
import { PostDeploymentQASummary } from './post-deployment-qa.schema.js';

export class PreviewDeploymentService {
  private providers = new Map<DeploymentProviderType, DeploymentProvider>();
  private logAnalyzer: DeploymentLogAnalyzer;
  private postDeploymentQA: PostDeploymentQAService;

  constructor(
    private db?: Database,
    private aiProvider?: AIProvider
  ) {
    const renderProvider = new RenderDeploymentProvider();
    const vercelProvider = new VercelDeploymentProvider();

    this.providers.set('render', renderProvider);
    this.providers.set('vercel', vercelProvider);

    this.logAnalyzer = new DeploymentLogAnalyzer(aiProvider);
    this.postDeploymentQA = new PostDeploymentQAService(db);
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
        runId: input.runId || null,
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

    // 5. Conduct Log Analysis if build logs are present
    let logAnalysis: DeploymentLogAnalysis | null = null;
    if (result.buildLogs || result.errorDetails) {
      const logsToAnalyze = `${result.buildLogs || ''}\n${result.errorDetails || ''}`;
      logAnalysis = await this.logAnalyzer.analyzeLogs(logsToAnalyze, {
        deploymentId: result.deploymentId,
        runId: input.runId,
        provider: result.provider,
        branchName: result.branchName,
      });

      // Update failure state if log analysis detects CRITICAL/HIGH build/runtime failures
      if (logAnalysis.outcome === 'FAIL' && result.status !== 'failed') {
        result.status = 'failed';
        result.errorDetails = logAnalysis.rootCause;
      }
    }

    // 6. Automatically trigger Post-Deployment QA if preview deployment status is READY
    if (result.status === 'ready' && result.previewUrl) {
      try {
        const qaSummary = await this.postDeploymentQA.triggerPostDeploymentQA(result.deploymentId, {
          previewUrl: result.previewUrl,
          branchName: result.branchName,
        });
        result.runId = qaSummary.runId;
      } catch {
        // Soft fallback for post-deployment QA trigger errors
      }
    }

    // 7. Redact Secrets from Output & Logs
    const safeResult: PreviewDeploymentResult = {
      ...result,
      runId: input.runId || result.runId || null,
      buildLogs: result.buildLogs ? redactString(result.buildLogs) : undefined,
      errorDetails: result.errorDetails ? redactString(result.errorDetails) : null,
      logAnalysis,
    };

    // 8. Persist Deployment Record to Database if DB client exists
    if (this.db) {
      try {
        await this.db.insert(previewDeployments).values({
          provider: safeResult.provider,
          runId: safeResult.runId || null,
          branchName: safeResult.branchName,
          prNumber: safeResult.prNumber || null,
          status: safeResult.status,
          previewUrl: safeResult.previewUrl || null,
          logsUrl: safeResult.logsUrl || null,
          buildLogs: safeResult.buildLogs || null,
          errorDetails: safeResult.errorDetails || null,
          logAnalysis: safeResult.logAnalysis || null,
        });
      } catch {
        // Ignore DB insert failure in test/mock environments
      }
    }

    return safeResult;
  }

  public async triggerPostDeploymentQA(
    deploymentId: string,
    options?: { forceReRun?: boolean; customTargetUrl?: string }
  ): Promise<PostDeploymentQASummary> {
    return this.postDeploymentQA.triggerPostDeploymentQA(deploymentId, options);
  }

  public async getPostDeploymentQAStatus(deploymentId: string): Promise<PostDeploymentQASummary> {
    return this.postDeploymentQA.getPostDeploymentQAStatus(deploymentId);
  }

  public async analyzeDeploymentLogs(
    rawLogs: string,
    options?: { deploymentId?: string; runId?: string; provider?: string; branchName?: string }
  ): Promise<DeploymentLogAnalysis> {
    return this.logAnalyzer.analyzeLogs(rawLogs, options);
  }

  public async getDeploymentStatus(
    deploymentId: string,
    input: PreviewDeploymentParams
  ): Promise<PreviewDeploymentResult> {
    this.validateTaskBranchPolicy(input.branchName);
    const provider = this.getProvider(input.provider);

    try {
      const result = await provider.getDeploymentStatus(deploymentId, input);
      let logAnalysis: DeploymentLogAnalysis | null = null;
      if (result.buildLogs || result.errorDetails) {
        logAnalysis = await this.logAnalyzer.analyzeLogs(
          `${result.buildLogs || ''}\n${result.errorDetails || ''}`,
          { deploymentId, runId: input.runId, provider: input.provider, branchName: input.branchName }
        );
      }

      return {
        ...result,
        runId: input.runId || result.runId || null,
        buildLogs: result.buildLogs ? redactString(result.buildLogs) : undefined,
        errorDetails: result.errorDetails ? redactString(result.errorDetails) : null,
        logAnalysis,
      };
    } catch (err: any) {
      const safeErrorMsg = redactString(err?.message || 'Failed to fetch deployment status');
      const now = new Date().toISOString();

      return {
        deploymentId,
        provider: input.provider,
        status: 'failed',
        runId: input.runId || null,
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

  public async getDeploymentAnalysisByRunId(runId: string): Promise<DeploymentLogAnalysis | null> {
    if (!this.db || !runId) return null;

    try {
      const record = await this.db.query.previewDeployments.findFirst({
        where: eq(previewDeployments.runId, runId),
        orderBy: desc(previewDeployments.createdAt),
      });

      if (record && record.logAnalysis) {
        return redactObject(record.logAnalysis);
      }

      if (record && record.buildLogs) {
        return this.logAnalyzer.analyzeLogs(record.buildLogs, {
          deploymentId: record.id,
          runId: record.runId || undefined,
          provider: record.provider,
          branchName: record.branchName,
        });
      }
    } catch {
      return null;
    }

    return null;
  }

  public async listDeployments(): Promise<PreviewDeploymentResult[]> {
    if (!this.db) return [];

    try {
      const records = await this.db.select().from(previewDeployments).orderBy(desc(previewDeployments.createdAt));
      return records.map((r: any) => ({
        deploymentId: r.id,
        provider: r.provider as DeploymentProviderType,
        status: r.status as any,
        runId: r.runId || null,
        previewUrl: r.previewUrl,
        logsUrl: r.logsUrl,
        buildLogs: r.buildLogs ? redactString(r.buildLogs) : undefined,
        errorDetails: r.errorDetails ? redactString(r.errorDetails) : null,
        logAnalysis: r.logAnalysis ? redactObject(r.logAnalysis) : null,
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
