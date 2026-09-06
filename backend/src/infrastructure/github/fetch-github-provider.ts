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


export class FetchGitHubProvider implements GitHubProvider {
  private defaultBaseUrl = 'https://api.github.com';

  private getBaseUrl(baseUrl?: string): string {
    const url = baseUrl || this.defaultBaseUrl;
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private getHeaders(token: string): Record<string, string> {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw new GitHubError('GITHUB_AUTH_FAILED', 'GitHub access token is required', 401);
    }

    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${cleanToken}`,
      'User-Agent': 'AgentOps-QA-Platform',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private handleResponseError(status: number, responseBody: any, owner?: string, repo?: string): never {
    const apiMessage = responseBody?.message || 'GitHub API request failed';

    if (status === 401) {
      throw new GitHubError('GITHUB_AUTH_FAILED', `GitHub authentication failed: Bad credentials or expired token`, 401);
    }
    if (status === 403) {
      if (apiMessage.toLowerCase().includes('rate limit')) {
        throw new GitHubError('GITHUB_RATE_LIMITED', 'GitHub API rate limit exceeded', 429);
      }
      throw new GitHubError('GITHUB_PERMISSION_DENIED', `Forbidden: Insufficient permissions for repository ${owner || ''}/${repo || ''}`.trim(), 403);
    }
    if (status === 404) {
      const target = owner && repo ? `Repository or path in '${owner}/${repo}'` : 'Resource';
      throw new GitHubError('GITHUB_REPO_NOT_FOUND', `${target} not found or token lacks access`, 404);
    }
    if (status === 429) {
      throw new GitHubError('GITHUB_RATE_LIMITED', 'GitHub API rate limit exceeded', 429);
    }

    throw new GitHubError('GITHUB_API_ERROR', `GitHub API error (${status}): ${apiMessage}`, status >= 500 ? 502 : status);
  }

  public async validateToken(token: string, baseUrl?: string): Promise<GitHubUser> {
    const apiBase = this.getBaseUrl(baseUrl);
    try {
      const response = await fetch(`${apiBase}/user`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.handleResponseError(response.status, body);
      }

      return {
        login: body.login,
        id: body.id,
        avatarUrl: body.avatar_url || null,
        type: body.type || 'User',
      };
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Network error connecting to GitHub: ${err.message}`, 502);
    }
  }

  public async getRepoMetadata(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubRepoMetadata> {
    const apiBase = this.getBaseUrl(baseUrl);
    const cleanOwner = owner.trim();
    const cleanRepo = repo.trim();

    if (!cleanOwner || !cleanRepo) {
      throw new GitHubError('GITHUB_API_ERROR', 'Owner and repo repository names are required', 400);
    }

    try {
      const response = await fetch(`${apiBase}/repos/${cleanOwner}/${cleanRepo}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.handleResponseError(response.status, body, cleanOwner, cleanRepo);
      }

      const permissions: GitHubPermissions = {
        admin: Boolean(body.permissions?.admin),
        push: Boolean(body.permissions?.push),
        pull: Boolean(body.permissions?.pull ?? true),
      };

      return {
        name: body.name,
        fullName: body.full_name,
        owner: body.owner?.login || cleanOwner,
        description: body.description || null,
        defaultBranch: body.default_branch || 'main',
        isPrivate: Boolean(body.private),
        htmlUrl: body.html_url,
        permissions,
        starsCount: body.stargazers_count ?? 0,
        forksCount: body.forks_count ?? 0,
        openIssuesCount: body.open_issues_count ?? 0,
      };
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Network error fetching repo metadata: ${err.message}`, 502);
    }
  }

  public async checkPermissions(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubPermissions> {
    const metadata = await this.getRepoMetadata(owner, repo, token, baseUrl);
    return metadata.permissions;
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
        error: err instanceof GitHubError ? err.message : (err.message || 'Connection test failed'),
      };
    }
  }

  public async readFile(owner: string, repo: string, path: string, ref: string | undefined, token: string, baseUrl?: string): Promise<GitHubFileContent> {
    const apiBase = this.getBaseUrl(baseUrl);
    const cleanPath = path.replace(/^\//, '');
    const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : '';

    try {
      const response = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${cleanPath}${refParam}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.handleResponseError(response.status, body, owner, repo);
      }

      if (Array.isArray(body)) {
        throw new GitHubError('GITHUB_API_ERROR', `Path '${cleanPath}' is a directory, not a single file`, 400);
      }

      let decodedContent = body.content || '';
      if (body.encoding === 'base64' && body.content) {
        decodedContent = Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      }

      return {
        name: body.name,
        path: body.path,
        sha: body.sha,
        size: body.size ?? 0,
        type: body.type || 'file',
        content: decodedContent,
        encoding: 'utf-8',
        downloadUrl: body.download_url || null,
        htmlUrl: body.html_url || null,
      };
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Network error reading file ${path}: ${err.message}`, 502);
    }
  }

  public async searchCode(owner: string, repo: string, query: string, token: string, baseUrl?: string): Promise<GitHubSearchResult> {
    const apiBase = this.getBaseUrl(baseUrl);
    const fullQuery = `${query} repo:${owner}/${repo}`;

    try {
      const response = await fetch(`${apiBase}/search/code?q=${encodeURIComponent(fullQuery)}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.handleResponseError(response.status, body, owner, repo);
      }

      const items = (body.items || []).map((item: any) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        htmlUrl: item.html_url,
        repository: item.repository?.full_name || `${owner}/${repo}`,
      }));

      return {
        totalCount: body.total_count ?? items.length,
        items,
      };
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Network error searching code in repo: ${err.message}`, 502);
    }
  }

  public async listBranches(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubBranch[]> {
    const apiBase = this.getBaseUrl(baseUrl);

    try {
      const response = await fetch(`${apiBase}/repos/${owner}/${repo}/branches?per_page=100`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      const body = await response.json().catch(() => ([]));
      if (!response.ok) {
        this.handleResponseError(response.status, body, owner, repo);
      }

      return (Array.isArray(body) ? body : []).map((b: any) => ({
        name: b.name,
        commitSha: b.commit?.sha || '',
        isProtected: Boolean(b.protected),
      }));
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Network error listing branches: ${err.message}`, 502);
    }
  }

  public async createTaskBranch(owner: string, repo: string, branchName: string, fromBranch: string | undefined, token: string, baseUrl?: string): Promise<GitHubBranch> {
    const apiBase = this.getBaseUrl(baseUrl);
    const baseBranch = fromBranch || 'main';

    try {
      // 1. Fetch latest commit SHA of baseBranch
      const refResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      const refBody = await refResponse.json().catch(() => ({}));
      if (!refResponse.ok) {
        this.handleResponseError(refResponse.status, refBody, owner, repo);
      }

      const commitSha = refBody.object?.sha;
      if (!commitSha) {
        throw new GitHubError('GITHUB_REPO_NOT_FOUND', `Base branch '${baseBranch}' commit SHA not found`, 404);
      }

      // 2. Create new branch ref
      const createResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: commitSha,
        }),
      });

      const createBody = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        if (createResponse.status === 422 && createBody.message?.toLowerCase().includes('already exists')) {
          throw new GitHubError('GITHUB_API_ERROR', `Branch '${branchName}' already exists`, 409);
        }
        this.handleResponseError(createResponse.status, createBody, owner, repo);
      }

      return {
        name: branchName,
        commitSha,
        isProtected: false,
      };
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Failed to create task branch '${branchName}': ${err.message}`, 502);
    }
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
    const apiBase = this.getBaseUrl(baseUrl);

    try {
      // 1. Get branch commit SHA
      const refResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });
      const refBody = await refResponse.json().catch(() => ({}));
      if (!refResponse.ok) {
        this.handleResponseError(refResponse.status, refBody, owner, repo);
      }
      const parentCommitSha = refBody.object?.sha;

      // 2. Get parent commit tree SHA
      const commitResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/commits/${parentCommitSha}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });
      const commitBody = await commitResponse.json().catch(() => ({}));
      if (!commitResponse.ok) {
        this.handleResponseError(commitResponse.status, commitBody, owner, repo);
      }
      const baseTreeSha = commitBody.tree?.sha;

      // 3. Create blobs for file changes & construct tree entries
      const treeEntries: Array<{ path: string; mode: string; type: string; sha: string | null }> = [];
      const filesCommitted: string[] = [];

      for (const change of changes) {
        const cleanPath = change.path.replace(/^\//, '');
        if (change.operation === 'delete') {
          treeEntries.push({ path: cleanPath, mode: '100644', type: 'blob', sha: null });
        } else {
          const blobResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/blobs`, {
            method: 'POST',
            headers: this.getHeaders(token),
            body: JSON.stringify({ content: change.content, encoding: 'utf-8' }),
          });
          const blobBody = await blobResponse.json().catch(() => ({}));
          if (!blobResponse.ok) {
            this.handleResponseError(blobResponse.status, blobBody, owner, repo);
          }
          treeEntries.push({ path: cleanPath, mode: '100644', type: 'blob', sha: blobBody.sha });
        }
        filesCommitted.push(cleanPath);
      }

      // 4. Create new tree
      const newTreeResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
      });
      const newTreeBody = await newTreeResponse.json().catch(() => ({}));
      if (!newTreeResponse.ok) {
        this.handleResponseError(newTreeResponse.status, newTreeBody, owner, repo);
      }

      // 5. Create new commit
      const newCommitResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({
          message: commitMessage,
          tree: newTreeBody.sha,
          parents: [parentCommitSha],
        }),
      });
      const newCommitBody = await newCommitResponse.json().catch(() => ({}));
      if (!newCommitResponse.ok) {
        this.handleResponseError(newCommitResponse.status, newCommitBody, owner, repo);
      }

      // 6. Update branch ref (force: false)
      const updateRefResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        headers: this.getHeaders(token),
        body: JSON.stringify({ sha: newCommitBody.sha, force: false }),
      });
      const updateRefBody = await updateRefResponse.json().catch(() => ({}));
      if (!updateRefResponse.ok) {
        this.handleResponseError(updateRefResponse.status, updateRefBody, owner, repo);
      }

      return {
        commitSha: newCommitBody.sha,
        branch,
        filesCommitted,
        commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitBody.sha}`,
      };
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Failed to apply file changes to branch '${branch}': ${err.message}`, 502);
    }
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
    const apiBase = this.getBaseUrl(baseUrl);

    try {
      const response = await fetch(`${apiBase}/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({ title, body, head, base }),
      });

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.handleResponseError(response.status, responseBody, owner, repo);
      }

      return {
        id: responseBody.id,
        number: responseBody.number,
        title: responseBody.title,
        body: responseBody.body || '',
        state: responseBody.state || 'open',
        htmlUrl: responseBody.html_url,
        headBranch: responseBody.head?.ref || head,
        baseBranch: responseBody.base?.ref || base,
        createdAt: responseBody.created_at || new Date().toISOString(),
        updatedAt: responseBody.updated_at || new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Failed to create pull request for '${head}': ${err.message}`, 502);
    }
  }

  public async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    token: string,
    baseUrl?: string
  ): Promise<GitHubPullRequest> {
    const apiBase = this.getBaseUrl(baseUrl);

    try {
      const response = await fetch(`${apiBase}/repos/${owner}/${repo}/pulls/${pullNumber}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.handleResponseError(response.status, responseBody, owner, repo);
      }

      return {
        id: responseBody.id,
        number: responseBody.number,
        title: responseBody.title,
        body: responseBody.body || '',
        state: responseBody.state || 'open',
        htmlUrl: responseBody.html_url,
        headBranch: responseBody.head?.ref || '',
        baseBranch: responseBody.base?.ref || '',
        createdAt: responseBody.created_at || new Date().toISOString(),
        updatedAt: responseBody.updated_at || new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Failed to fetch pull request #${pullNumber}: ${err.message}`, 502);
    }
  }

  public async getPRCheckStatus(
    owner: string,
    repo: string,
    pullNumber: number,
    token: string,
    baseUrl?: string
  ): Promise<GitHubPRCheckStatusResult> {
    const apiBase = this.getBaseUrl(baseUrl);
    const pr = await this.getPullRequest(owner, repo, pullNumber, token, baseUrl);

    try {
      // Get head commit SHA of the PR
      const refResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/git/ref/heads/${pr.headBranch}`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });
      const refBody = await refResponse.json().catch(() => ({}));
      const headSha = refBody.object?.sha || 'unknown-sha';

      // 1. Fetch check runs
      const checkRunsResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/commits/${headSha}/check-runs`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });
      const checkRunsBody = await checkRunsResponse.json().catch(() => ({}));
      const checkRuns: GitHubCheckRunStatus[] = (checkRunsBody.check_runs || []).map((cr: any) => ({
        id: cr.id,
        name: cr.name,
        status: cr.status,
        conclusion: cr.conclusion,
        htmlUrl: cr.html_url || '',
      }));

      // 2. Fetch combined status
      const statusResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/commits/${headSha}/status`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });
      const statusBody = await statusResponse.json().catch(() => ({}));
      const combinedStatus: GitHubCombinedStatus | null = statusResponse.ok ? {
        state: statusBody.state || 'pending',
        totalCount: statusBody.total_count ?? 0,
        statuses: (statusBody.statuses || []).map((s: any) => ({
          context: s.context,
          state: s.state,
          description: s.description || null,
          targetUrl: s.target_url || null,
        })),
      } : null;

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
    } catch (err: any) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GITHUB_API_ERROR', `Failed to fetch PR #${pullNumber} check status: ${err.message}`, 502);
    }
  }
}

