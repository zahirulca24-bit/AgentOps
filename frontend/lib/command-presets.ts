import { QAOptionConfig, QAOptionsState, CommandPreset } from '@/types';

export const QA_OPTIONS_CONFIG: QAOptionConfig[] = [
  {
    key: 'autoExplore',
    label: 'Auto Explore',
    description: 'Crawl unvisited interactive elements and discover route trees automatically.',
    defaultEnabled: true,
    category: 'core',
  },
  {
    key: 'functionalTests',
    label: 'Functional Tests',
    description: 'Assert button interactions, form submissions, and critical user flows.',
    defaultEnabled: true,
    category: 'core',
  },
  {
    key: 'visualChecks',
    label: 'Visual Checks',
    description: 'Inspect layout alignment, visual clipping, and responsive viewport integrity.',
    defaultEnabled: false,
    category: 'core',
  },
  {
    key: 'consoleMonitoring',
    label: 'Console Monitoring',
    description: 'Capture browser console exceptions, unhandled rejections, and warnings.',
    defaultEnabled: true,
    category: 'observability',
  },
  {
    key: 'networkMonitoring',
    label: 'Network Monitoring',
    description: 'Track failed 4xx/5xx requests, slow API endpoints, and payload errors.',
    defaultEnabled: true,
    category: 'observability',
  },
  {
    key: 'screenshotEvidence',
    label: 'Screenshot Evidence',
    description: 'Capture step-by-step visual DOM snapshots on key assertions and defects.',
    defaultEnabled: true,
    category: 'observability',
  },
];

export const DEFAULT_QA_OPTIONS: QAOptionsState = {
  autoExplore: true,
  functionalTests: true,
  visualChecks: false,
  consoleMonitoring: true,
  networkMonitoring: true,
  screenshotEvidence: true,
};

/**
 * Isolated Preview Command History / Presets (Prompt 5 requirement)
 */
export const RECENT_COMMAND_PRESETS: CommandPreset[] = [
  {
    id: 'preset_full',
    title: 'Full Test Suite',
    targetUrl: 'https://demo.playwright.dev/todomvc/',
    prompt: 'Run a full exploratory test, checking functional behavior, visuals, console, and network. Add a todo, complete it, and clear completed.',
    options: { autoExplore: true, functionalTests: true, visualChecks: true, consoleMonitoring: true, networkMonitoring: true, screenshotEvidence: true },
    category: 'Full',
    timestamp: 'Just now',
  },
  {
    id: 'preset_login',
    title: 'Login Flow',
    targetUrl: 'https://demo.playwright.dev/todomvc/',
    prompt: 'Simulate a login or basic entry flow, asserting the main workspace loads properly.',
    options: { autoExplore: false, functionalTests: true, visualChecks: false, consoleMonitoring: true, networkMonitoring: true, screenshotEvidence: true },
    category: 'Login',
    timestamp: 'Just now',
  },
  {
    id: 'preset_regression',
    title: 'Regression',
    targetUrl: 'https://demo.playwright.dev/todomvc/',
    prompt: 'Check for dead links, console errors, and basic layout structure to ensure no regressions.',
    options: { autoExplore: true, functionalTests: false, visualChecks: false, consoleMonitoring: true, networkMonitoring: true, screenshotEvidence: false },
    category: 'Regression',
    timestamp: 'Just now',
  },
  {
    id: 'preset_visual',
    title: 'Visual Checks',
    targetUrl: 'https://demo.playwright.dev/todomvc/',
    prompt: 'Focus entirely on visual integrity, layout alignment, and missing elements.',
    options: { autoExplore: false, functionalTests: false, visualChecks: true, consoleMonitoring: false, networkMonitoring: false, screenshotEvidence: true },
    category: 'Visual',
    timestamp: 'Just now',
  },
  {
    id: 'preset_network',
    title: 'Network & Console Monitoring',
    targetUrl: 'https://demo.playwright.dev/todomvc/',
    prompt: 'Monitor all network traffic and console outputs for any errors or slow API endpoints while exploring.',
    options: { autoExplore: true, functionalTests: false, visualChecks: false, consoleMonitoring: true, networkMonitoring: true, screenshotEvidence: false },
    category: 'Network',
    timestamp: 'Just now',
  },
];

/**
 * Frontend Target URL Validation
 * Helpful UX feedback for obviously invalid URLs without attempting SSRF/security checks.
 */
export function validateTargetUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return 'Target URL is required.';
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return 'URL must begin with http:// or https:// (e.g. https://example.com)';
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return 'Please provide a valid domain (e.g. https://staging.example.com)';
    }
  } catch {
    return 'Invalid URL format. Please check the address.';
  }

  return null;
}

/**
 * Frontend Command Prompt Validation
 */
export function validateCommandPrompt(prompt: string): string | null {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return 'Test instruction prompt is required.';
  }

  if (trimmed.length < 10) {
    return 'Please describe what to test in more detail (at least 10 characters).';
  }

  return null;
}
