export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'BROWSER_SESSION_NOT_FOUND'
  | 'BROWSER_TIMEOUT'
  | 'NAVIGATION_BLOCKED'
  | 'NAVIGATION_FAILED'
  | 'ACTION_FAILED'
  | 'ACTION_LIMIT_REACHED'
  | 'SECURITY_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'GITHUB_AUTH_FAILED'
  | 'GITHUB_REPO_NOT_FOUND'
  | 'GITHUB_PERMISSION_DENIED'
  | 'GITHUB_RATE_LIMITED'
  | 'GITHUB_API_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
