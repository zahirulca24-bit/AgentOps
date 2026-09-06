import type { GitHubProvider } from './github.provider.js';
import type {
  GitHubRepoConfig,
  MaskedGitHubRepoConfig,
  GitHubUser,
  GitHubRepoMetadata,
  GitHubPermissions,
  GitHubConnectionTestResult,
  GitHubFileContent,
  GitHubSearchResult,
  GitHubBranch,
  GitHubBranchPermissionResult,
  GitHubCommitInput,
  GitHubCommitResult,
  GitHubPullRequestInput,
  GitHubPullRequest,
  GitHubPRCheckStatusResult,
} from './github.types.js';
import { GitHubError } from './github.errors.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';

export class GitHubService {
  constructor(private provider: GitHubProvider) {}

  public static maskToken(token: string): string {
    if (!token || typeof token !== 'string') return '';
    const trimmed = token.trim();
    if (trimmed.length <= 8) return '****';
    return `${trimmed.substring(0, 4)}****${trimmed.substring(trimmed.length - 4)}`;
  }

  public toMaskedConfig(config: GitHubRepoConfig, id?: string, projectId?: string): MaskedGitHubRepoConfig {
    return {
      id,
      projectId: projectId || null,
      owner: config.owner,
      repo: config.repo,
      defaultBranch: config.defaultBranch || 'main',
      baseUrl: config.baseUrl || 'https://api.github.com',
      maskedToken: GitHubService.maskToken(config.token),
    };
  }

  public validateBranchName(branchName: string, defaultBranch: string = 'main'): { valid: boolean; reason?: string } {
    if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
      return { valid: false, reason: 'Branch name cannot be empty' };
    }
    const trimmed = branchName.trim();
    const normalizedDefault = defaultBranch.toLowerCase();
    const normalizedTarget = trimmed.toLowerCase();
    if (normalizedTarget === normalizedDefault || ['main', 'master', 'production', 'release'].includes(normalizedTarget)) {
      return { valid: false, reason: `Direct modifications to default branch '${trimmed}' are strictly forbidden. Every code change must use a dedicated task branch.` };
    }
    if (/\s/.test(trimmed)) return { valid: false, reason: 'Branch name cannot contain whitespace' };
    if (/\.\./.test(trimmed)) return { valid: false, reason: 'Branch name cannot contain sequence ".."' };
    if (/[~^:?*\[\\@]/.test(trimmed)) return { valid: false, reason: 'Branch name contains invalid git ref characters (~, ^, :, ?, *, [, \\, @)' };
    if (trimmed.endsWith('/') || trimmed.endsWith('.lock') || trimmed.startsWith('/')) return { valid: false, reason: 'Branch name cannot start or end with slash, or end with .lock' };
    return { valid: true };
  }

  public async validateToken(token: string, baseUrl?: string): Promise<GitHubUser> { return this.provider.validateToken(token, baseUrl); }
  public async getRepoMetadata(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubRepoMetadata> { return this.provider.getRepoMetadata(owner, repo, token, baseUrl); }
  public async checkPermissions(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubPermissions> { return this.provider.checkPermissions(owner, repo, token, baseUrl); }
  public async testConnection(config: GitHubRepoConfig): Promise<GitHubConnectionTestResult> { return this.provider.testConnection(config); }
  public async readFile(owner: string, repo: string, path: string, ref: string | undefined, token: string, baseUrl?: string): Promise<GitHubFileContent> { return this.provider.readFile(owner, repo, path, ref, token, baseUrl); }
  public async searchCode(owner: string, repo: string, query: string, token: string, baseUrl?: string): Promise<GitHubSearchResult> { return this.provider.searchCode(owner, repo, query, token, baseUrl); }
  public async listBranches(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubBranch[]> { return this.provider.listBranches(owner, repo, token, baseUrl); }

  public async checkBranchPermissions(owner: string, repo: string, branchName: string, token: string, baseUrl?: string): Promise<GitHubBranchPermissionResult> {
    const meta = await this.getRepoMetadata(owner, repo, token, baseUrl);
    const branchVal = this.validateBranchName(branchName, meta.defaultBranch);
    if (!branchVal.valid) return { canCreateBranch: false, isProtected: branchName.toLowerCase() === meta.defaultBranch.toLowerCase(), canPushDirectly: false, reason: branchVal.reason };
    const branches = await this.listBranches(owner, repo, token, baseUrl);
    const existingBranch = branches.find(b => b.name === branchName);
    const canPush = meta.permissions.push;
    return { canCreateBranch: canPush && !existingBranch, isProtected: existingBranch ? existingBranch.isProtected : false, canPushDirectly: false, reason: canPush ? (existingBranch ? `Branch '${branchName}' already exists` : undefined) : 'Insufficient repository write (push) permissions' };
  }

  public async createTaskBranch(owner: string, repo: string, branchName: string, fromBranch: string | undefined, token: string, baseUrl?: string): Promise<GitHubBranch> {
    const meta = await this.getRepoMetadata(owner, repo, token, baseUrl);
    const baseBranch = fromBranch || meta.defaultBranch;
    const validation = this.validateBranchName(branchName, meta.defaultBranch);
    if (!validation.valid) throw new GitHubError('GITHUB_PERMISSION_DENIED', validation.reason || 'Invalid branch name', 403);
    if (!meta.permissions.push) throw new GitHubError('GITHUB_PERMISSION_DENIED', `Insufficient push permissions to create branch '${branchName}' in ${owner}/${repo}`, 403);
    return this.provider.createTaskBranch(owner, repo, branchName, baseBranch, token, baseUrl);
  }

  public async applyFileChanges(input: GitHubCommitInput): Promise<GitHubCommitResult> {
    const meta = await this.getRepoMetadata(input.owner, input.repo, input.token, input.baseUrl);
    const validation = this.validateBranchName(input.branch, meta.defaultBranch);
    if (!validation.valid) throw new GitHubError('GITHUB_PERMISSION_DENIED', validation.reason || 'Invalid branch name for commit', 403);
    if (!input.changes || input.changes.length === 0) throw new GitHubError('GITHUB_API_ERROR', 'At least one file change must be provided for commit', 400);

    // Redact secrets in commit message and file contents
    const safeCommitMessage = redactString(input.commitMessage || 'Fix: Autonomous code changes');
    const safeChanges = input.changes.map(c => ({
      path: c.path,
      content: redactString(c.content),
      operation: c.operation || 'update',
    }));

    return this.provider.applyFileChanges(input.owner, input.repo, input.branch, safeCommitMessage, safeChanges, input.token, input.baseUrl);
  }

  public formatPullRequestBody(input: GitHubPullRequestInput): string {
    const sections: string[] = [];
    if (input.body && input.body.trim()) sections.push(input.body.trim());
    if (input.findingSummary) {
      const f = input.findingSummary;
      sections.push(`### 🐛 Finding Details\n- **Title**: ${f.title}\n- **Severity**: \`${f.severity.toUpperCase()}\` \n- **Description**: ${f.description}\n${f.expectedResult ? `- **Expected**: ${f.expectedResult}\n` : ''}${f.actualResult ? `- **Actual**: ${f.actualResult}\n` : ''}`);
    }
    if (input.rootCauseAnalysis) {
      const r = input.rootCauseAnalysis;
      sections.push(`### 🔬 AI Root-Cause Analysis\n- **Likely Cause**: ${r.likelyCause}\n${r.suspectedFileOrComponent ? `- **Suspected Area**: \`${r.suspectedFileOrComponent}\` \n` : ''}- **Recommended Action**: ${r.recommendedAction}\n${r.facts?.length ? `- **Facts**: ${r.facts.join('; ')}\n` : ''}${r.inference?.length ? `- **Inference**: ${r.inference.join('; ')}\n` : ''}`);
    }
    if (input.testRunnerResult) {
      const t = input.testRunnerResult;
      let section = `### 🧪 Test Execution Summary\n- **Overall Status**: ${t.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      if (t.durationMs !== undefined) section += `- **Duration**: ${t.durationMs}ms\n`;
      if (t.testSuitesRun?.length) {
        section += '- **Suites Executed**:\n';
        for (const s of t.testSuitesRun) section += `  - \`${s.name}\`: ${s.passed ? 'PASSED' : 'FAILED'}\n`;
      }
      if (t.failedCommands?.length) section += `- **Failed Commands**: ${t.failedCommands.join(', ')}\n`;
      sections.push(section);
    }
    return redactString(sections.join('\n\n') || 'Autonomous code fix proposed by AgentOps platform.');
  }

  public async createPullRequest(input: GitHubPullRequestInput): Promise<GitHubPullRequest> {
    const meta = await this.getRepoMetadata(input.owner, input.repo, input.token, input.baseUrl);
    const baseBranch = input.base || meta.defaultBranch;
    const validation = this.validateBranchName(input.head, meta.defaultBranch);
    if (!validation.valid) throw new GitHubError('GITHUB_PERMISSION_DENIED', `Cannot create pull request from branch '${input.head}': ${validation.reason}`, 403);
    if (input.testRunnerResult && input.testRunnerResult.passed === false) throw new GitHubError('GITHUB_API_ERROR', `Pull request creation blocked: Required test suites failed for task branch '${input.head}'. Fix all failing tests before opening a pull request.`, 400);
    return this.provider.createPullRequest(input.owner, input.repo, input.head, baseBranch, redactString(input.title), this.formatPullRequestBody(input), input.token, input.baseUrl);
  }

  public async getPRCheckStatus(owner: string, repo: string, pullNumber: number, token: string, baseUrl?: string): Promise<GitHubPRCheckStatusResult> {
    return this.provider.getPRCheckStatus(owner, repo, pullNumber, token, baseUrl);
  }
}
