export interface ExecutionRootCause {
  key: string;
  title: string;
  likelyCause: string;
  affectedArea: string;
  recommendedNextAction: string;
}

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<id>')
    .replace(/\b\d+ms\b/g, '<duration>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export function deriveExecutionRootCause(errorMessage?: string | null): ExecutionRootCause {
  const message = (errorMessage || 'Unknown execution failure').trim();
  const normalized = normalizeMessage(message);

  if (
    /invalid url|url must be|url is missing|url is malformed|failed to parse url|target url/.test(normalized)
  ) {
    return {
      key: 'target-url-propagation',
      title: 'Execution Error: Target URL propagation',
      likelyCause: 'The canonical target URL was missing or malformed before browser navigation.',
      affectedArea: 'QA execution target propagation',
      recommendedNextAction: 'Verify the run, task, and project target URL chain before generating or executing tests.',
    };
  }

  if (/navigation blocked/.test(normalized)) {
    return {
      key: `navigation-policy:${normalized}`,
      title: 'Execution Error: Navigation policy blocked target',
      likelyCause: message,
      affectedArea: 'Browser navigation security policy',
      recommendedNextAction: 'Verify the target host is public, permitted, and resolves outside blocked network ranges.',
    };
  }

  const assertion = normalized.match(/assertion failed:\s*([a-z0-9_-]+)/i);
  if (assertion) {
    return {
      key: `assertion:${assertion[1]}:${normalized}`,
      title: `QA Failure: ${assertion[1]} assertion`,
      likelyCause: message,
      affectedArea: 'QA assertion evaluation',
      recommendedNextAction: 'Inspect the shared page state and selector/response condition behind the failed assertion.',
    };
  }

  return {
    key: `execution:${normalized || 'unknown'}`,
    title: 'Execution Error: Shared runtime failure',
    likelyCause: message,
    affectedArea: 'QA execution runtime',
    recommendedNextAction: 'Inspect the shared execution context, browser logs, and network evidence for the underlying failure.',
  };
}
