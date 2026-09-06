import { AppError, type ErrorCode } from '../../core/errors.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';

export class GitHubError extends AppError {
  constructor(code: ErrorCode, message: string, statusCode: number = 400) {
    // Ensure all secrets/tokens in error messages are sanitized and redacted
    const safeMessage = redactString(message);
    super(code, safeMessage, statusCode);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
