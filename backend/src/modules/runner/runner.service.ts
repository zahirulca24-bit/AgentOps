import { exec } from 'child_process';
import { promisify } from 'util';
import { AppError } from '../../core/errors.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';
import type {
  TestType,
  TestRunnerConfig,
  TestSuiteRunResult,
  TestRunnerResult,
} from './runner.types.js';

const execAsync = promisify(exec);

export type CommandExecutorFn = (
  command: string,
  cwd: string,
  timeoutMs: number,
  maxBufferBytes: number
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

export class FixTestRunnerService {
  private ALLOWLIST_COMMANDS = new Set([
    'npx vitest run tests/unit',
    'npx vitest run tests/integration',
    'npx vitest run tests/integration/browser.test.ts',
  ]);

  constructor(
    private cwd: string = process.cwd(),
    private customExecutor?: CommandExecutorFn
  ) {}

  public validateTaskBranchPolicy(branchName: string, defaultBranch: string = 'main'): void {
    if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'Target task branch name is required', 400);
    }

    const trimmed = branchName.trim();
    const normalizedDefault = defaultBranch.toLowerCase();
    const normalizedTarget = trimmed.toLowerCase();

    if (normalizedTarget === normalizedDefault || ['main', 'master', 'production', 'release'].includes(normalizedTarget)) {
      throw new AppError(
        'FORBIDDEN',
        `Direct code fix test executions on default branch '${trimmed}' are strictly blocked. Every fix execution must target a task branch (e.g. agentops/task-101).`,
        403
      );
    }
  }

  public resolveAllowlistCommand(type: TestType, changedFiles: string[] = []): string {
    if (type === 'unit') {
      return 'npx vitest run tests/unit';
    }
    if (type === 'integration') {
      return 'npx vitest run tests/integration';
    }
    if (type === 'browser_qa') {
      return 'npx vitest run tests/integration/browser.test.ts';
    }
    if (type === 'changed_area_regression') {
      const matchedTest = this.mapChangedFilesToTestSpec(changedFiles);
      return matchedTest;
    }
    throw new AppError('VALIDATION_ERROR', `Unsupported test suite type: ${type}`, 400);
  }

  public mapChangedFilesToTestSpec(changedFiles: string[]): string {
    if (!changedFiles || changedFiles.length === 0) {
      return 'npx vitest run tests/unit';
    }

    for (const filePath of changedFiles) {
      const lower = filePath.toLowerCase();
      if (lower.includes('github')) {
        return 'npx vitest run tests/unit/github.service.test.ts';
      }
      if (lower.includes('fix')) {
        return 'npx vitest run tests/unit/fix.service.test.ts';
      }
      if (lower.includes('severity')) {
        return 'npx vitest run tests/unit/severity.service.test.ts';
      }
      if (lower.includes('analysis') || lower.includes('root-cause')) {
        return 'npx vitest run tests/unit/analysis.service.test.ts';
      }
      if (lower.includes('generator')) {
        return 'npx vitest run tests/unit/generator.service.test.ts';
      }
      if (lower.includes('planner')) {
        return 'npx vitest run tests/unit/planner.service.test.ts';
      }
      if (lower.includes('security')) {
        return 'npx vitest run tests/unit/security.test.ts';
      }
    }

    return 'npx vitest run tests/unit';
  }

  private isCommandAllowed(command: string): boolean {
    if (this.ALLOWLIST_COMMANDS.has(command)) {
      return true;
    }
    // Allow vitest test spec runs matching tests/unit/*.test.ts or tests/integration/*.test.ts
    const vitestPattern = /^npx vitest run tests\/(unit|integration)\/[a-zA-Z0-9_.-]+\.test\.ts$/;
    return vitestPattern.test(command);
  }

  private async defaultExecute(
    command: string,
    cwd: string,
    timeoutMs: number,
    maxBufferBytes: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: maxBufferBytes,
        env: { ...process.env, NODE_ENV: 'test' },
      });
      return { stdout: stdout || '', stderr: stderr || '', exitCode: 0 };
    } catch (err: any) {
      const stdout = err.stdout || '';
      const stderr = err.stderr || err.message || '';
      const exitCode = typeof err.code === 'number' ? err.code : 1;
      return { stdout, stderr, exitCode };
    }
  }

  public async runTests(config: TestRunnerConfig): Promise<TestRunnerResult> {
    const startTime = Date.now();

    // 1. Enforce Task Branch Requirement
    this.validateTaskBranchPolicy(config.branchName);

    const suiteTypes: TestType[] = config.suiteTypes || ['unit', 'integration', 'changed_area_regression'];
    const timeoutMs = config.timeoutMs || 30000;
    const maxBufferBytes = config.maxOutputBytes || 100000;
    const changedFiles = config.changedFiles || [];

    const executor = this.customExecutor || this.defaultExecute.bind(this);
    const suiteResults: TestSuiteRunResult[] = [];
    const failedCommands: string[] = [];

    // Deduplicate command executions
    const executedCommands = new Set<string>();

    for (const suiteType of suiteTypes) {
      const command = this.resolveAllowlistCommand(suiteType, changedFiles);

      // Verify command is in the strict allowlist before execution
      if (!this.isCommandAllowed(command)) {
        throw new AppError('SECURITY_ERROR', `Command '${command}' is not in the safe test runner allowlist`, 403);
      }

      if (executedCommands.has(command)) {
        continue;
      }
      executedCommands.add(command);

      const suiteStart = Date.now();
      const execResult = await executor(command, this.cwd, timeoutMs, maxBufferBytes);
      const durationMs = Date.now() - suiteStart;
      const passed = execResult.exitCode === 0;

      const safeStdout = redactString(execResult.stdout.slice(-2000));
      const safeStderr = redactString(execResult.stderr.slice(-2000));

      if (!passed) {
        failedCommands.push(command);
      }

      suiteResults.push({
        type: suiteType,
        command,
        passed,
        durationMs,
        errorSummary: passed ? undefined : safeStderr || 'Test command failed with non-zero exit code',
        stdoutSnippet: safeStdout || undefined,
      });
    }

    const totalDurationMs = Date.now() - startTime;
    const overallPassed = failedCommands.length === 0;

    const logsSummary = overallPassed
      ? `All ${suiteResults.length} test suite(s) passed successfully on task branch '${config.branchName}' in ${totalDurationMs}ms.`
      : `Test runner failed ${failedCommands.length} of ${suiteResults.length} suite(s) on branch '${config.branchName}'. Failed commands: ${failedCommands.join(', ')}`;

    return {
      passed: overallPassed,
      failedCommands,
      logsSummary,
      durationMs: totalDurationMs,
      affectedBranch: config.branchName,
      issueId: config.issueId || null,
      testSuitesRun: suiteResults,
    };
  }
}
