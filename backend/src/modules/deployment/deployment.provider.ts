export type DeploymentProviderType = 'render' | 'vercel';
export type DeploymentStatus = 'building' | 'ready' | 'failed' | 'cancelled';

export interface PreviewDeploymentParams {
  provider: DeploymentProviderType;
  branchName: string;
  repoOwner?: string;
  repoName?: string;
  prNumber?: number;
  commitSha?: string;
  apiToken?: string;
  serviceId?: string;
  projectId?: string;
  teamId?: string;
  customDomain?: string;
  environmentVars?: Record<string, string>;
  simulateFailure?: boolean;
}

export interface PreviewDeploymentResult {
  deploymentId: string;
  provider: DeploymentProviderType;
  status: DeploymentStatus;
  previewUrl?: string | null;
  logsUrl?: string | null;
  buildLogs?: string;
  errorDetails?: string | null;
  branchName: string;
  prNumber?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentProvider {
  readonly providerType: DeploymentProviderType;
  createPreviewDeployment(params: PreviewDeploymentParams): Promise<PreviewDeploymentResult>;
  getDeploymentStatus(deploymentId: string, params: PreviewDeploymentParams): Promise<PreviewDeploymentResult>;
  cancelDeployment?(deploymentId: string, params: PreviewDeploymentParams): Promise<boolean>;
}
