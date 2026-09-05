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
    id: 'preset_auth',
    title: 'Authentication & Account Creation',
    targetUrl: 'https://staging.example.com/signup',
    prompt: 'Test the registration and login flows. Attempt signup with an invalid email format to verify form validation, then log in with test credentials and assert redirection to the onboarding workspace.',
    options: {
      autoExplore: true,
      functionalTests: true,
      visualChecks: false,
      consoleMonitoring: true,
      networkMonitoring: true,
      screenshotEvidence: true,
    },
    category: 'Auth Flows',
    timestamp: '2 hours ago',
  },
  {
    id: 'preset_checkout',
    title: 'Cart & Stripe Checkout Funnel',
    targetUrl: 'https://ecommerce.example.com/store',
    prompt: 'Add an item to the shopping cart, proceed through the checkout steps, fill in test billing details, and verify order summary calculations before triggering final confirmation.',
    options: {
      autoExplore: false,
      functionalTests: true,
      visualChecks: true,
      consoleMonitoring: true,
      networkMonitoring: true,
      screenshotEvidence: true,
    },
    category: 'E-commerce',
    timestamp: 'Yesterday',
  },
  {
    id: 'preset_links',
    title: 'Navigation & Dead Link Discovery',
    targetUrl: 'https://docs.example.com',
    prompt: 'Crawl the main documentation sidebar links, verify all internal anchor hrefs resolve with HTTP 200, and flag any 404 dead links or broken page anchors.',
    options: {
      autoExplore: true,
      functionalTests: false,
      visualChecks: false,
      consoleMonitoring: true,
      networkMonitoring: true,
      screenshotEvidence: false,
    },
    category: 'Regression',
    timestamp: '3 days ago',
  },
  {
    id: 'preset_responsive',
    title: 'Responsive Viewport & Form Validation',
    targetUrl: 'https://app.example.com/settings/profile',
    prompt: 'Test form input boundaries, unicode names, and check that modal dialogs display cleanly without horizontal overflow or clipped buttons.',
    options: {
      autoExplore: false,
      functionalTests: true,
      visualChecks: true,
      consoleMonitoring: true,
      networkMonitoring: false,
      screenshotEvidence: true,
    },
    category: 'UI/UX',
    timestamp: '5 days ago',
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
