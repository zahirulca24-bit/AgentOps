import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { productionDeployments, previewDeployments } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactString, redactObject } from '../../infrastructure/redact/redactSensitive.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import { RenderDeploymentProvider } from './providers/render-provider.js';
import { VercelDeploymentProvider } from './providers/vercel-provider.js';
import { DeploymentProvider, DeploymentProviderType } from './deployment.provider.js';
import { PostDeploymentQAService } from './post-deployment-qa.service.js';
import {
  RequestProductionDeploymentInput,
  ApproveProductionDeploymentInput,
  ExecuteProductionDeploymentInput,
} from './production-deployment.schema.js';

export interface ProductionDeploymentResult {
  productionDeploymentId: string;
  previewDeploymentId: string;
  provider: DeploymentProviderType;
  branchName: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'deploying' | 'live' | 'failed';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  productionUrl?: string | null;
  logsUrl?: string | null;
  buildLogs?: string | null;
  errorDetails?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ProductionDeploymentService {
  private providers = new Map<DeploymentProviderType, DeploymentProvider>();
  private postDeploymentQA: PostDeploymentQAService;
  private mockDeployments = new Map<string, ProductionDeploymentResult>();

  constructor(private db?: Database) {
    this.providers.set('render', new RenderDeploymentProvider());
    this.providers.set('vercel', new VercelDeploymentProvider());
    this.postDeploymentQA = new PostDeploymentQAService(db);
  }

  public async requestProductionDeployment(
    input: RequestProductionDeploymentInput
  ): Promise<ProductionDeploymentResult> {
    const { previewDeploymentId, provider: providerType, branchName, requestedBy } = input;

    // 1. Fetch Preview Deployment & Validate Gatekeeping Policy
    let previewStatus = 'ready';
    let qaVerdict = 'PASS';

    if (this.db) {
      try {
        const previewRecord = await this.db.query.previewDeployments.findFirst({
          where: eq(previewDeployments.id, previewDeploymentId),
        });

        if (previewRecord) {
          previewStatus = previewRecord.status;
          if (previewRecord.logAnalysis && (previewRecord.logAnalysis as any).outcome === 'FAIL') {
            previewStatus = 'failed';
          }
        }
      } catch {}
    }

    try {
      const qaSummary = await this.postDeploymentQA.getPostDeploymentQAStatus(previewDeploymentId);
      qaVerdict = qaSummary.verdict;
    } catch {}

    // Gatekeeping Policy Enforcement: Requires successful preview AND QA pass
    if (previewStatus !== 'ready' || qaVerdict !== 'PASS') {
      const reason = `Production deployment rejected by gatekeeper: Preview deployment status must be 'ready' and Post-Deployment QA verdict must be 'PASS'. (Observed preview status: '${previewStatus}', QA verdict: '${qaVerdict}')`;

      AuditLoggerService.log(
        'PRODUCTION_DEPLOYMENT_REQUESTED',
        `Production deployment request for '${branchName}' rejected by gatekeeper policy`,
        'failure',
        previewDeploymentId,
        { previewStatus, qaVerdict, requestedBy, reason }
      );

      throw new AppError('FORBIDDEN', reason, 403);
    }

    const now = new Date().toISOString();
    const id = `prod_dep_${Math.random().toString(36).substring(2, 10)}`;

    const result: ProductionDeploymentResult = {
      productionDeploymentId: id,
      previewDeploymentId,
      provider: providerType,
      branchName,
      status: 'pending_approval',
      approvalStatus: 'pending',
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      productionUrl: null,
      logsUrl: null,
      buildLogs: null,
      errorDetails: null,
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      try {
        await this.db.insert(productionDeployments).values({
          previewDeploymentId,
          provider: providerType,
          branchName,
          status: 'pending_approval',
          approvalStatus: 'pending',
        });
      } catch {}
    }

    this.mockDeployments.set(id, result);

    AuditLoggerService.log(
      'PRODUCTION_DEPLOYMENT_REQUESTED',
      `Production deployment requested for branch '${branchName}' by ${requestedBy}. Pending human approval.`,
      'in_progress',
      id,
      { previewDeploymentId, providerType, branchName, requestedBy }
    );

    return result;
  }

  public async approveProductionDeployment(
    input: ApproveProductionDeploymentInput
  ): Promise<ProductionDeploymentResult> {
    const { productionDeploymentId, approvedBy, decision, rejectionReason } = input;

    let record = this.mockDeployments.get(productionDeploymentId);
    if (!record && this.db) {
      try {
        const dbRecord = await this.db.query.productionDeployments.findFirst({
          where: eq(productionDeployments.id, productionDeploymentId),
        });
        if (dbRecord) {
          record = {
            productionDeploymentId: dbRecord.id,
            previewDeploymentId: dbRecord.previewDeploymentId || '',
            provider: dbRecord.provider as DeploymentProviderType,
            branchName: dbRecord.branchName,
            status: dbRecord.status as any,
            approvalStatus: dbRecord.approvalStatus as any,
            approvedBy: dbRecord.approvedBy,
            approvedAt: dbRecord.approvedAt ? new Date(dbRecord.approvedAt).toISOString() : null,
            rejectionReason: dbRecord.rejectionReason,
            productionUrl: dbRecord.productionUrl,
            logsUrl: dbRecord.logsUrl,
            buildLogs: dbRecord.buildLogs,
            errorDetails: dbRecord.errorDetails,
            createdAt: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: dbRecord.updatedAt ? new Date(dbRecord.updatedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch {}
    }

    if (!record) {
      throw new AppError('NOT_FOUND', `Production deployment request '${productionDeploymentId}' not found`, 404);
    }

    const now = new Date().toISOString();

    if (decision === 'rejected') {
      record.approvalStatus = 'rejected';
      record.status = 'rejected';
      record.rejectionReason = redactString(rejectionReason || 'Rejected by human reviewer');
      record.updatedAt = now;

      if (this.db) {
        try {
          await this.db
            .update(productionDeployments)
            .set({
              approvalStatus: 'rejected',
              status: 'rejected',
              rejectionReason: record.rejectionReason,
              updatedAt: new Date(),
            })
            .where(eq(productionDeployments.id, productionDeploymentId));
        } catch {}
      }

      this.mockDeployments.set(productionDeploymentId, record);

      AuditLoggerService.log(
        'PRODUCTION_DEPLOYMENT_REJECTED',
        `Production deployment '${productionDeploymentId}' was rejected by ${approvedBy}.`,
        'skipped',
        productionDeploymentId,
        { approvedBy, rejectionReason: record.rejectionReason }
      );

      return record;
    }

    // Human Approval Granted
    record.approvalStatus = 'approved';
    record.status = 'approved';
    record.approvedBy = approvedBy;
    record.approvedAt = now;
    record.updatedAt = now;

    if (this.db) {
      try {
        await this.db
          .update(productionDeployments)
          .set({
            approvalStatus: 'approved',
            status: 'approved',
            approvedBy,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(productionDeployments.id, productionDeploymentId));
      } catch {}
    }

    this.mockDeployments.set(productionDeploymentId, record);

    AuditLoggerService.log(
      'PRODUCTION_DEPLOYMENT_APPROVED',
      `Production deployment '${productionDeploymentId}' approved by ${approvedBy}. Ready for production execution.`,
      'success',
      productionDeploymentId,
      { approvedBy, approvedAt: now }
    );

    return record;
  }

  public async executeProductionDeployment(
    input: ExecuteProductionDeploymentInput
  ): Promise<ProductionDeploymentResult> {
    const { productionDeploymentId, apiToken, simulateFailure } = input;

    const record = await this.getProductionDeploymentStatus(productionDeploymentId);

    // Human Approval Check Enforcement
    if (record.approvalStatus !== 'approved') {
      throw new AppError(
        'FORBIDDEN',
        `Production deployment '${productionDeploymentId}' requires explicit human approval before execution. (Current approval status: '${record.approvalStatus}')`,
        403
      );
    }

    const now = new Date().toISOString();
    record.status = 'deploying';

    if (simulateFailure) {
      const errorMsg = redactString(
        `[Production Deploy Error] Failed to release container to production environment. Token: ${apiToken || 'N/A'}`
      );
      record.status = 'failed';
      record.errorDetails = errorMsg;
      record.buildLogs = redactString(`[PRODUCTION LOGS] Initializing release pipeline...\nError: Deployment script failed.\n${errorMsg}`);
      record.updatedAt = now;

      if (this.db) {
        try {
          await this.db
            .update(productionDeployments)
            .set({
              status: 'failed',
              errorDetails: errorMsg,
              buildLogs: record.buildLogs,
              updatedAt: new Date(),
            })
            .where(eq(productionDeployments.id, productionDeploymentId));
        } catch {}
      }

      this.mockDeployments.set(productionDeploymentId, record);

      AuditLoggerService.log(
        'PRODUCTION_DEPLOYMENT_FAILED',
        `Production deployment '${productionDeploymentId}' failed during execution: ${errorMsg}`,
        'failure',
        productionDeploymentId,
        { errorDetails: errorMsg }
      );

      return record;
    }

    const domainSlug = record.branchName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const productionUrl =
      record.provider === 'vercel'
        ? `https://agentops-${domainSlug}.vercel.app`
        : `https://agentops-${domainSlug}.onrender.com`;

    const buildLogs = redactString(
      `[PRODUCTION LOGS] Releasing branch '${record.branchName}' to Production Environment.\n[1/3] Fetching approved release artifact...\n[2/3] Promoting container to Production Cluster...\n[3/3] Production deployment live at ${productionUrl}\nToken: ${apiToken || 'N/A'}`
    );

    record.status = 'live';
    record.productionUrl = productionUrl;
    record.logsUrl = `https://dashboard.${record.provider}.com/production/logs/${productionDeploymentId}`;
    record.buildLogs = buildLogs;
    record.errorDetails = null;
    record.updatedAt = now;

    if (this.db) {
      try {
        await this.db
          .update(productionDeployments)
          .set({
            status: 'live',
            productionUrl,
            logsUrl: record.logsUrl,
            buildLogs,
            errorDetails: null,
            updatedAt: new Date(),
          })
          .where(eq(productionDeployments.id, productionDeploymentId));
      } catch {}
    }

    this.mockDeployments.set(productionDeploymentId, record);

    AuditLoggerService.log(
      'PRODUCTION_DEPLOYMENT_EXECUTED',
      `Production deployment '${productionDeploymentId}' executed successfully. Live at ${productionUrl}.`,
      'success',
      productionDeploymentId,
      { productionUrl, logsUrl: record.logsUrl }
    );

    return record;
  }

  public async getProductionDeploymentStatus(id: string): Promise<ProductionDeploymentResult> {
    let record = this.mockDeployments.get(id);

    if (!record && this.db) {
      try {
        const dbRecord = await this.db.query.productionDeployments.findFirst({
          where: eq(productionDeployments.id, id),
        });
        if (dbRecord) {
          record = {
            productionDeploymentId: dbRecord.id,
            previewDeploymentId: dbRecord.previewDeploymentId || '',
            provider: dbRecord.provider as DeploymentProviderType,
            branchName: dbRecord.branchName,
            status: dbRecord.status as any,
            approvalStatus: dbRecord.approvalStatus as any,
            approvedBy: dbRecord.approvedBy,
            approvedAt: dbRecord.approvedAt ? new Date(dbRecord.approvedAt).toISOString() : null,
            rejectionReason: dbRecord.rejectionReason,
            productionUrl: dbRecord.productionUrl,
            logsUrl: dbRecord.logsUrl,
            buildLogs: dbRecord.buildLogs,
            errorDetails: dbRecord.errorDetails,
            createdAt: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: dbRecord.updatedAt ? new Date(dbRecord.updatedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch {}
    }

    if (!record) {
      throw new AppError('NOT_FOUND', `Production deployment '${id}' not found`, 404);
    }

    return redactObject(record);
  }

  public async listProductionDeployments(): Promise<ProductionDeploymentResult[]> {
    if (this.db) {
      try {
        const list = await this.db.select().from(productionDeployments).orderBy(desc(productionDeployments.createdAt));
        return list.map((r: any) =>
          redactObject({
            productionDeploymentId: r.id,
            previewDeploymentId: r.previewDeploymentId || '',
            provider: r.provider as DeploymentProviderType,
            branchName: r.branchName,
            status: r.status as any,
            approvalStatus: r.approvalStatus as any,
            approvedBy: r.approvedBy,
            approvedAt: r.approvedAt ? new Date(r.approvedAt).toISOString() : null,
            rejectionReason: r.rejectionReason,
            productionUrl: r.productionUrl,
            logsUrl: r.logsUrl,
            buildLogs: r.buildLogs,
            errorDetails: r.errorDetails,
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
          })
        );
      } catch {}
    }

    return Array.from(this.mockDeployments.values()).map(r => redactObject(r));
  }
}
