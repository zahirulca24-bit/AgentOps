import { AppError } from '../../core/errors.js';

const COMMAND_URL_RE = /https?:\/\/[^\s<>"'`\])}]+/i;
const HOST_LIKE_RE = /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i;

function cleanCandidate(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function assertHttpProtocol(url: URL): URL {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('VALIDATION_ERROR', 'Target URL must use http or https', 400);
  }
  return url;
}

export function extractTargetUrlFromCommand(command?: string | null): string | undefined {
  const match = cleanCandidate(command)?.match(COMMAND_URL_RE)?.[0];
  if (!match) return undefined;
  return match.replace(/[.,;:!?]+$/, '');
}

export function normalizeAbsoluteTargetUrl(value: string): string {
  const candidate = cleanCandidate(value);
  if (!candidate) {
    throw new AppError('VALIDATION_ERROR', 'Target URL is missing', 400);
  }

  let parsed: URL;
  try {
    parsed = assertHttpProtocol(new URL(candidate));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('VALIDATION_ERROR', 'Target URL is malformed', 400);
  }

  return parsed.toString();
}

export interface EffectiveTargetUrlInput {
  runTargetUrl?: string | null;
  taskTargetUrl?: string | null;
  projectTargetUrl?: string | null;
  command?: string | null;
}

export function resolveEffectiveTargetUrl(input: EffectiveTargetUrlInput): string {
  const candidates = [
    cleanCandidate(input.runTargetUrl),
    cleanCandidate(input.taskTargetUrl),
    cleanCandidate(input.projectTargetUrl),
    extractTargetUrlFromCommand(input.command),
  ].filter((candidate): candidate is string => Boolean(candidate));

  if (candidates.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Target URL is missing from the run, task, project, and command',
      400,
    );
  }

  // A malformed value in one layer must not poison a valid canonical value from
  // the next layer. This is the core propagation fallback chain.
  for (const candidate of candidates) {
    try {
      return normalizeAbsoluteTargetUrl(candidate);
    } catch {
      // Continue to the next real backend source.
    }
  }

  throw new AppError('VALIDATION_ERROR', 'Target URL is malformed in all available run contexts', 400);
}

/**
 * Convert a generated navigation target into a safe syntactically valid URL.
 * Missing/malformed generated values fall back to the canonical run target so
 * a propagation defect cannot fan out into many "Invalid URL" test failures.
 */
export function resolveNavigationUrl(candidate: string | undefined, effectiveTargetUrl: string): string {
  const base = normalizeAbsoluteTargetUrl(effectiveTargetUrl);
  const raw = cleanCandidate(candidate);
  if (!raw) return base;

  try {
    if (/^https?:\/\//i.test(raw)) {
      return assertHttpProtocol(new URL(raw)).toString();
    }

    if (HOST_LIKE_RE.test(raw)) {
      const baseUrl = new URL(base);
      return assertHttpProtocol(new URL(`${baseUrl.protocol}//${raw}`)).toString();
    }

    if (/\s/.test(raw) || /^[.#\[]/.test(raw)) return base;

    return assertHttpProtocol(new URL(raw, base)).toString();
  } catch {
    return base;
  }
}
