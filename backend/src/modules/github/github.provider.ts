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
} from './github.types.js';

export interface GitHubProvider {
  validateToken(token: string, baseUrl?: string): Promise<GitHubUser>;
  getRepoMetadata(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubRepoMetadata>;
  checkPermissions(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubPermissions>;
  testConnection(config: GitHubRepoConfig): Promise<GitHubConnectionTestResult>;
  readFile(owner: string, repo: string, path: string, ref: string | undefined, token: string, baseUrl?: string): Promise<GitHubFileContent>;
  searchCode(owner: string, repo: string, query: string, token: string, baseUrl?: string): Promise<GitHubSearchResult>;
  listBranches(owner: string, repo: string, token: string, baseUrl?: string): Promise<GitHubBranch[]>;
  createTaskBranch(owner: string, repo: string, branchName: string, fromBranch: string | undefined, token: string, baseUrl?: string): Promise<GitHubBranch>;
  applyFileChanges(owner: string, repo: string, branch: string, commitMessage: string, changes: GitHubFileChange[], token: string, baseUrl?: string): Promise<GitHubCommitResult>;
  createPullRequest(owner: string, repo: string, head: string, base: string, title: string, body: string, token: string, baseUrl?: string): Promise<GitHubPullRequest>;
  getPullRequest(owner: string, repo: string, pullNumber: number, token: string, baseUrl?: string): Promise<GitHubPullRequest>;
  getPRCheckStatus(owner: string, repo: string, pullNumber: number, token: string, baseUrl?: string): Promise<GitHubPRCheckStatusResult>;
}

