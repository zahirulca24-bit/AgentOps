export type TestType = 'unit' | 'integration' | 'browser_qa' | 'changed_area_regression';

export interface TestRunnerConfig {
  branchName: string;
  issueId?: string;
  suiteTypes?: TestType[];
  changedFiles?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface TestSuiteRunResult {
  type: TestType;
  command: string;
  passed: boolean;
  durationMs: number;
  errorSummary?: string;
  stdoutSnippet?: string;
}

export interface TestRunnerResult {
  passed: boolean;
  failedCommands: string[];
  logsSummary: string;
  durationMs: number;
  affectedBranch: string;
  issueId?: string | null;
  testSuitesRun: TestSuiteRunResult[];
}
