export type QAOptionKey =
  | 'autoExplore'
  | 'functionalTests'
  | 'visualChecks'
  | 'consoleMonitoring'
  | 'networkMonitoring'
  | 'screenshotEvidence';

export interface QAOptionConfig {
  key: QAOptionKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
  category: 'core' | 'observability';
}

export type QAOptionsState = Record<QAOptionKey, boolean>;

export interface CommandFormData {
  targetUrl: string;
  prompt: string;
  options: QAOptionsState;
}

export interface CommandPreset {
  id: string;
  title: string;
  targetUrl: string;
  prompt: string;
  options: QAOptionsState;
  category: string;
  timestamp: string;
}

export interface CommandValidationErrors {
  targetUrl?: string;
  prompt?: string;
}

export interface StagedDispatchPayload {
  stagedId: string;
  targetUrl: string;
  prompt: string;
  enabledOptions: QAOptionKey[];
  stagedAt: string;
}
