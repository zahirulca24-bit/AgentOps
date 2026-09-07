/**
 * Utility for redacting sensitive secrets, credentials, tokens, and headers
 * from logs, errors, console outputs, SSE events, and persisted evidence.
 */

const SENSITIVE_PATTERNS = [
  // Bearer tokens & Authorization headers
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /Basic\s+[A-Za-z0-9+/]+=*/gi,

  // Key-value credentials & API keys
  /(?:api[_-]?key|secret|password|passwd|auth[_-]?token|access[_-]?token|refresh[_-]?token|private[_-]?key)\s*[:=]\s*["']?([^"'\s,;&]+)["']?/gi,

  // Database Connection Strings containing passwords: e.g. postgresql://user:pass@host:5432/db
  /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/([^:]+):([^@]+)@/gi,

  // Generic JWT Tokens (header.payload.signature)
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi,

  // GitHub tokens (PAT, OAuth, User/Server tokens)
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/gi,
  /github_pat_[A-Za-z0-9_]{80,}/gi,
];

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'api_key',
  'gemini_api_key',
  'database_url',
  'github_token',
  'githubtoken',
  'github_pat',
  'pat',
  'personalaccesstoken',
  'personal_access_token',
]);

export function redactString(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let redacted = input;

  // Redact DB URLs
  redacted = redacted.replace(/(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/([^:]+):([^@]+)@/gi, '$1://$2:[REDACTED]@');

  // Redact Bearer / Basic tokens
  redacted = redacted.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  redacted = redacted.replace(/Basic\s+[A-Za-z0-9+/]+=*/gi, 'Basic [REDACTED]');

  // Redact GitHub tokens
  redacted = redacted.replace(/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+/gi, '[REDACTED_GITHUB_TOKEN]');
  redacted = redacted.replace(/github_pat_[A-Za-z0-9_]+/gi, '[REDACTED_GITHUB_PAT]');

  // Redact key=value or key: value
  redacted = redacted.replace(
    /(?:api[_-]?key|secret|password|passwd|auth[_-]?token|access[_-]?token|refresh[_-]?token|private[_-]?key|github[_-]?token|token)\s*([:=])\s*["']?([^"'\s,;&]+)["']?/gi,
    (match, separator, value) => {
      if (value && value.startsWith('[REDACTED')) return match;
      return `${match.split(separator)[0]}${separator}"[REDACTED]"`;
    }
  );

  // Redact JWT tokens
  redacted = redacted.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi, '[REDACTED_JWT]');

  return redacted;
}

export function redactObject<T = any>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return redactString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const redactedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        redactedObj[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        redactedObj[key] = redactString(value);
      } else if (typeof value === 'object' && value !== null) {
        redactedObj[key] = redactObject(value);
      } else {
        redactedObj[key] = value;
      }
    }
    return redactedObj as T;
  }

  return obj;
}
