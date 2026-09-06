import type { GitHubProvider } from '../../modules/github/github.provider.js';
import type {
  GitHubRepoConfig,
  GitHubUser,
  GitHubRepoMetadata,
  GitHubPermissions,
  GitHubConnectionTestResult,
  GitHubFileContent,
  GitHubSearchResult,
  GitHubBranch,
  GitHubFileChange,
  GitHubCommitResult,
  GitHubPullRequest,
  GitHubPRCheckStatusResult,
  GitHubCheckRunStatus,
  GitHubCombinedStatus,
} from '../../modules/github/github.types.js';
import { GitHubError } from '../../modules/github/github.errors.js';

export class MockGitHubProvider implements GitHubProvider {
  public mockUser: GitHubUser | null = {
    login: 'octocat',
    id: 583231,
    avatarUrl: 'https://github.com/images/error/octocat_happy.gif',
    type: 'User',
  };

  public mockRepo: GitHubRepoMetadata | null = {
    name: 'agentops-repo',
    fullName: 'octocat/agentops-repo',
    owner: 'octocat',
    description: 'Autonomous QA and Testing Engine',
    defaultBranch: 'main',
    isPrivate: true,
    htmlUrl: 'https://github.com/octocat/agentops-repo',
    permissions: {
      admin: true,
      push: true,
      pull: true,
    },
    starsCount: 42,
    forksCount: 7,
    openIssuesCount: 3,
  };

  public mockFiles: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'agentops', version: '1.0.0' }, null, 2),
    'src/index.ts': 'console.log("Hello AgentOps");',
    'README.md': '# AgentOps Platform\nAutonomous QA Testing',
  };

  public mockBranches: GitHubBranch[] = [
    { name: 'main', commitSha: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b', isProtected: true },
    { name: 'dev', commitSha: '0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e', isProtected: false },
  ];

  public mockPullRequests: GitHubPullRequest[] = [
    {
      id: 101,
      number: 1,
      title: 'Fix(auth): Resolve session token expiration crash',
      body: 'Fixes session token expiration crash.',
      state: 'open',
      htmlUrl: 'https://github.com/octocat/agentops-repo/pull/1',
      headBranch: 'agentops/task-101',
      baseBranch: 'main',
      createdAt: '2026-09-06T00:00:00Z',
      updatedAt: '2026-09-06T00:00:00Z',
    },
  ];

  public mockCheckRuns: GitHubCheckRunStatus[] = [
    {
      id: 1001,
      name: 'unit-tests',
      status: 'completed',
      conclusion: 'success',
      htmlUrl: 'https://github.com/octocat/agentops-repo/runs/1001',
    },
    {
      id: 1002,
      name: 'integration-tests',
      status: 'completed',
      conclusion: 'success',
      htmlUrl: 'https://github.com/octocat/agentops-repo/runs/1002',
    },
  ];

  public mockCombinedStatus: GitHubCombinedStatus | null = {
    state: 'success',
    totalCount: 1,
    statuses: [
      {
        context: 'continuous-integration/jenkins',
        state: 'success',
        description: 'Build passed cleanly',
        targetUrl: 'https://ci.example.com/build/123',
      },
    ],
  };

  public shouldFailAuth = false;
  public shouldFailRepoNotFound = false;
  public shouldFailPermissionDenied = false;
  public shouldFailRateLimit = false;

  public async validateToken(token: string, _baseUrl?: string): Promise<GitHubUser> {
    if (!token || token.trim() === '' || token.includes('invalid') || this.shouldFailAuth) {
      throw new GitHubError('GITHUB_AUTH_FAILED', 'GitHub authentication failed: Bad credentials or expired token', 401);
    }
    if (this.shouldFailRateLimit) {
      throw new GitHubError('GITHUB_RATE_LIMITED', 'GitHub API rate limit exceeded', 429);
    }
    return this.mockUser || { login: 'mock-user', id: 100, avatarUrl: null, type: 'User' };
  }

  public async getRepoMetadata(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubRepoMetadata> {
    await this.validateToken(token, baseUrl);

    if (this.shouldFailRepoNotFound || owner === 'nonexistent') {
      throw new GitHubError('GITHUB_REPO_NOT_FOUND', `Repository '${owner}/${repo}' not found or token lacks read access`, 404);
    }
    if (this.shouldFailPermissionDenied) {
      throw new GitHubError('GITHUB_PERMISSION_DENIED', `Forbidden: Insufficient permissions for repository ${owner}/${repo}`, 403);
    }

    return this.mockRepo || {
      name: repo,
      fullName: `${owner}/${repo}`,
      owner,
      description: 'Mocked Repository',
      defaultBranch: 'main',
      isPrivate: false,
      htmlUrl: `https://github.com/${owner}/${repo}`,
      permissions: { admin: false, push: true, pull: true },
      starsCount: 0,
      forksCount: 0,
      openIssuesCount: 0,
    };
  }

  public async checkPermissions(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubPermissions> {
    const meta = await this.getRepoMetadata(owner, repo, token, baseUrl);
    return meta.permissions;
  }

  public async testConnection(config: GitHubRepoConfig): Promise<GitHubConnectionTestResult> {
    try {
      const user = await this.validateToken(config.token, config.baseUrl);
      const repo = await this.getRepoMetadata(config.owner, config.repo, config.token, config.baseUrl);
      return {
        success: true,
        authenticatedUser: user.login,
        repo,
        permissions: repo.permissions,
      };
    } catch (err: any) {
      return {
        success: false,
        authenticatedUser: null,
        repo: null,
        permissions: null,
        error: err.message || 'Connection failed',
      };
    }
  }

  public async readFile(owner: string, repo: string, path: string, _ref: string | undefined, token: string, baseUrl?: string): Promise<GitHubFileContent> {
    await this.getRepoMetadata(owner, repo, token, baseUrl);
    const cleanPath = path.replace(/^\//, '');

    if (!(cleanPath in this.mockFiles)) {
      throw new GitHubError('GITHUB_REPO_NOT_FOUND', `File '${cleanPath}' not found in repository ${owner}/${repo}`, 404);
    }

    const content = this.mockFiles[cleanPath];
    return {
      name: cleanPath.split('/').pop() || cleanPath,
      path: cleanPath,
      sha: 'mock-sha-' + cleanPath.length,
      size: content.length,
      type: 'file',
      content,
      encoding: 'utf-8',
      downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/main/${cleanPath}`,
      htmlUrl: `https://github.com/${owner}/${repo}/blob/main/${cleanPath}`,
    };
  }

  public async searchCode(owner: string, repo: string, query: string, token: string, baseUrl?: string): Promise<GitHubSearchResult> {
    await this.getRepoMetadata(owner, repo, token, baseUrl);

    const matches = Object.entries(this.mockFiles).filter(([filePath, fileContent]) =>
      filePath.toLowerCase().includes(query.toLowerCase()) ||
      fileContent.toLowerCase().includes(query.toLowerCase())
    );

    const items = matches.map(([filePath]) => ({
      name: filePath.split('/').pop() || filePath,
      path: filePath,
      sha: 'mock-sha-' + filePath.length,
      htmlUrl: `https://github.com/${owner}/${repo}/blob/main/${filePath}`,
      repository: `${owner}/${repo}`,
    }));

    return {
      totalCount: items.length,
      items,
    };
  }

  public async listBranches(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubBranch[]> {
    await this.getRepoMetadata(owner, repo, token, baseUrl);
    return [...this.mockBranches];
  }

  public async createTaskBranch(owner: string, repo: string, branchName: string, fromBranch: string | undefined, token: string, baseUrl?: string): Promise<GitHubBranch> {
    await this.getRepoMetadata(owner, repo, token, baseUrl);

    const existing = this.mockBranches.find(b => b.name === branchName);
    if (existing) {
      throw new GitHubError('GITHUB_API_ERROR', `Branch '${branchName}' already exists`, 409);
    }

    const baseName = fromBranch || 'main';
    const baseBranch = this.mockBranches.find(b => b.name === baseName) || this.mockBranches[0];

    const newBranch: GitHubBranch = {
      name: branchName,
      commitSha: baseBranch?.commitSha || 'mock-sha-new-branch',
      isProtected: false,
    };

    this.mockBranches.push(newBranch);
    return newBranch;
  }

  public async applyFileChanges(
    owner: string,
    repo: string,
    branch: string,
    commitMessage: string,
    changes: GitHubFileChange[],
    token: string,
    baseUrl?: string
  ): Promise<GitHubCommitResult> {
    await this.getRepoMetadata(owner, repo, token, baseUrl);

    const targetBranch = this.mockBranches.find(b => b.name === branch);
    if (!targetBranch) {
      throw new GitHubError('GITHUB_REPO_NOT_FOUND', `Target task branch '${branch}' not found. Create a task branch first.`, 404);
    }

    const filesCommitted: string[] = [];
    for (const change of changes) {
      const cleanPath = change.path.replace(/^\//, '');
      if (change.operation === 'delete') {
        delete this.mockFiles[cleanPath];
      } else {
        this.mockFiles[cleanPath] = change.content;
      }
      filesCommitted.push(cleanPath);
    }

    const newCommitSha = 'mock-commit-sha-' + Date.now().toString(36);
    targetBranch.commitSha = newCommitSha;

    return {
      commitSha: newCommitSha,
      branch,
      filesCommitted,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
    };
  }

  public async createPullRequest(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
    token: string,
    baseUrl?: string
  ): Promise<GitHubPullRequest> {
    await this.getRepoMetadata(owner, repo, token, baseUrl);

    const prNumber = this.mockPullRequests.length + 1;
    const newPr: GitHubPullRequest = {
      id: 1000 + prNumber,
      number: prNumber,
      title,
      body,
      state: 'open',
      htmlUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
      headBranch: head,
      baseBranch: base,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.mockPullRequests.push(newPr);
    return newPr;
  }

  public async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    token: string,
    baseUrl?: string
  ): Promise<GitHubPullRequest> {
    await this.getRepoMetadata(owner, repo, token, baseUrl);

    const pr = this.mockPullRequests.find(p => p.number === pullNumber);
    if (!pr) {
      throw new GitHubError('GITHUB_REPO_NOT_FOUND', `Pull request #${pullNumber} not found in ${owner}/${repo}`, 404);
    }

    return pr;
  }

  public async getPRCheckStatus(
    owner: string,
    repo: string,
    pullNumber: number,
    token: string,
    baseUrl?: string
  ): Promise<GitHubPRCheckStatusResult> {
    const pr = await this.getPullRequest(owner, repo, pullNumber, token, baseUrl);
    const branch = this.mockBranches.find(b => b.name === pr.headBranch);
    const headSha = branch?.commitSha || 'mock-head-sha';

    const checkRuns = [...this.mockCheckRuns];
    const combinedStatus = this.mockCombinedStatus;

    const hasFailedCheck = checkRuns.some(c => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out');
    const hasFailedStatus = combinedStatus?.state === 'failure' || combinedStatus?.state === 'error';
    const isPending = checkRuns.some(c => c.status === 'queued' || c.status === 'in_progress') || combinedStatus?.state === 'pending';

    let overallStatus: 'passed' | 'failed' | 'pending' | 'unknown' = 'passed';
    if (hasFailedCheck || hasFailedStatus) {
      overallStatus = 'failed';
    } else if (isPending) {
      overallStatus = 'pending';
    } else if (checkRuns.length === 0 && !combinedStatus) {
      overallStatus = 'unknown';
    }

    return {
      prNumber: pullNumber,
      headSha,
      overallStatus,
      checkRuns,
      combinedStatus,
    };
  }
}

