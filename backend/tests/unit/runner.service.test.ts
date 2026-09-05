import { describe, it, expect, beforeEach } from 'vitest';
import { FixTestRunnerService, type CommandExecutorFn } from '../../src/modules/runner/runner.service.js';

describe('FixTestRunnerService - Unit Tests', () => {
  let mockExecutor: CommandExecutorFn;
  let service: FixTestRunnerService;
  let mockExecCalls: Array<{ command: string; timeoutMs: number }>;

  beforeEach(() => {
    mockExecCalls = [];
    mockExecutor = async (command: string, _cwd: string, timeoutMs: number, _maxBuffer: number) => {
      mockExecCalls.push({ command, timeoutMs });
      if (command.includes('fail')) {
        return {
          stdout: 'FAIL tests/unit/example.test.ts with token ghp_SECRET_1234567890abcdef',
          stderr: 'AssertionError: expected true to be false',
          exitCode: 1,
        };
      }
      return {
        stdout: '✓ All tests passed with token ghp_SECRET_1234567890abcdef',
        stderr: '',
        exitCode: 0,
      };
    };

    service = new FixTestRunnerService(process.cwd(), mockExecutor);
  });

  describe('Task Branch Policy Enforcement', () => {
    it('allows valid task branch names (e.g. agentops/task-401)', () => {
      expect(() => service.validateTaskBranchPolicy('agentops/task-401')).not.toThrow();
    });

    it('blocks direct executions on default branch main/master with 403 FORBIDDEN', () => {
      expect(() => service.validateTaskBranchPolicy('main')).toThrow('strictly blocked');
      expect(() => service.validateTaskBranchPolicy('master')).toThrow('strictly blocked');
    });

    it('throws validation error if branch name is empty', () => {
      expect(() => service.validateTaskBranchPolicy('')).toThrow('branch name is required');
    });
  });

  describe('Command Allowlist & Changed-Area Mapping', () => {
    it('resolves unit, integration, and browser QA test commands from allowlist', () => {
      expect(service.resolveAllowlistCommand('unit')).toBe('npx vitest run tests/unit');
      expect(service.resolveAllowlistCommand('integration')).toBe('npx vitest run tests/integration');
      expect(service.resolveAllowlistCommand('browser_qa')).toBe('npx vitest run tests/integration/browser.test.ts');
    });

    it('maps changed files to targeted regression test specs', () => {
      const githubCmd = service.resolveAllowlistCommand('changed_area_regression', ['src/modules/github/github.service.ts']);
      expect(githubCmd).toBe('npx vitest run tests/unit/github.service.test.ts');

      const fixCmd = service.resolveAllowlistCommand('changed_area_regression', ['src/modules/fix/fix.service.ts']);
      expect(fixCmd).toBe('npx vitest run tests/unit/fix.service.test.ts');
    });

    it('defaults changed_area_regression to tests/unit if no specific match is found', () => {
      const cmd = service.resolveAllowlistCommand('changed_area_regression', ['src/random/unknown.ts']);
      expect(cmd).toBe('npx vitest run tests/unit');
    });
  });

  describe('Test Execution & Secret Redaction', () => {
    it('executes configured test suites and returns structured pass results', async () => {
      const result = await service.runTests({
        branchName: 'agentops/task-402',
        suiteTypes: ['unit', 'integration'],
      });

      expect(result.passed).toBe(true);
      expect(result.failedCommands.length).toBe(0);
      expect(result.affectedBranch).toBe('agentops/task-402');
      expect(result.testSuitesRun.length).toBe(2);
      expect(result.logsSummary).toContain('passed successfully');
      expect(mockExecCalls.length).toBe(2);
    });

    it('handles test failures gracefully and records failed commands', async () => {
      // Inject failure executor for integration tests
      const failingExecutor: CommandExecutorFn = async (command, cwd, timeoutMs, maxBuffer) => {
        if (command.includes('integration')) {
          return { stdout: 'FAIL integration', stderr: 'Test failed: timeout', exitCode: 1 };
        }
        return mockExecutor(command, cwd, timeoutMs, maxBuffer);
      };

      const failService = new FixTestRunnerService(process.cwd(), failingExecutor);
      const result = await failService.runTests({
        branchName: 'agentops/task-403',
        suiteTypes: ['unit', 'integration'],
      });

      expect(result.passed).toBe(false);
      expect(result.failedCommands).toContain('npx vitest run tests/integration');
      expect(result.logsSummary).toContain('Failed commands');
    });

    it('redacts tokens and credentials from test stdout/stderr snippets', async () => {
      const result = await service.runTests({
        branchName: 'agentops/task-404',
        suiteTypes: ['unit'],
      });

      const stdout = result.testSuitesRun[0].stdoutSnippet || '';
      expect(stdout).not.toContain('ghp_SECRET_1234567890abcdef');
      expect(stdout).toContain('[REDACTED_GITHUB_TOKEN]');
    });
  });
});
