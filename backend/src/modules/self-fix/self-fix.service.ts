import { eq } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { issues } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';
import { RootCauseAnalysisService } from '../analysis/analysis.service.js';
import { CodeFixService } from '../fix/fix.service.js';
import { FixTestRunnerService } from '../runner/runner.service.js';
import { GitHubService } from '../github/github.service.js';
import type { GitHubProvider } from '../github/github.provider.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import type {
  SelfFixLoopInput,
  SelfFixLoopResult,
  SelfFixAttemptRecord,
} from './self-fix.types.js';
import type { RootCauseAnalysisOutput } from '../analysis/analysis.schema.js';


export class SelfFixLoopService {
  private githubService?: GitHubService;

  constructor(
    private db: Database,
    private rootCauseAnalysisService: RootCauseAnalysisService,
    private codeFixService: CodeFixService,
    private fixTestRunnerService: FixTestRunnerService,
    githubProvider?: GitHubProvider
  ) {
    if (githubProvider) {
      this.githubService = new GitHubService(githubProvider);
    }
  }

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
        `Direct code fix loop executions on default branch '${trimmed}' are strictly blocked. Every fix loop execution must target a dedicated task branch (e.g. agentops/task-101).`,
        403
      );
    }
  }

  public calculatePatchSignature(fileChanges: Array<{ path: string; newContent: string }>): string {
    if (!fileChanges || fileChanges.length === 0) return 'empty_patch';
    const sorted = [...fileChanges].sort((a, b) => a.path.localeCompare(b.path));
    const normalized = sorted.map(f => ({
      path: f.path.replace(/^\//, ''),
      content: f.newContent.trim(),
    }));
    return JSON.stringify(normalized);
  }

  public formatEscalationSummary(
    issueTitle: string,
    rca: RootCauseAnalysisOutput | null,
    attempts: SelfFixAttemptRecord[]
  ): string {
    const sections: string[] = [
      `## 🚨 Human Escalation Report for Finding: ${issueTitle}`,
      `The autonomous self-fixing engine executed ${attempts.length} repair attempts on task branch without passing all required test suites.`,
    ];

    if (rca) {
      sections.push(
        `### 🔬 Diagnostic Root-Cause Context\n` +
        `- **Likely Cause**: ${rca.likelyCause}\n` +
        `- **Suspected Component**: \`${rca.suspectedComponent || 'N/A'}\` \n` +
        `- **Recommended Action**: ${rca.recommendedNextAction}`
      );
    }

    sections.push(`### 📋 Attempt Audit History`);
    for (const att of attempts) {
      const icon = att.status === 'passed' ? '✅' : att.status === 'rejected_duplicate' ? '⚠️' : '❌';
      sections.push(
        `#### Attempt ${att.attemptNumber} (${icon} ${att.status.toUpperCase()})\n` +
        `- **Fix Explanation**: ${att.fixProposal?.explanation || 'N/A'}\n` +
        `- **Changed Files**: ${(att.fixProposal?.changedFiles || []).join(', ') || 'None'}\n` +
        `- **Test Duration**: ${att.testResult?.durationMs || 0}ms\n` +
        (att.testResult?.failedCommands?.length ? `- **Failed Commands**: ${att.testResult.failedCommands.join(', ')}\n` : '') +
        (att.errorDetails ? `- **Status Note**: ${att.errorDetails}\n` : '')
      );
    }

    sections.push(
      `### 💡 Next Steps for Engineers\n` +
      `Review the task branch changes and failed test output above. Manual code intervention or refined test assertions are required.`
    );

    return redactString(sections.join('\n\n'));
  }

  public async runSelfFixLoop(input: SelfFixLoopInput): Promise<SelfFixLoopResult> {
    // 1. Enforce Task Branch Requirement
    this.validateTaskBranchPolicy(input.branchName);

    const maxAttempts = Math.min(Math.max(input.maxAttempts || 3, 1), 3);

    // 2. Fetch Finding / Issue Record from DB
    const issueRecord = await this.db.query.issues.findFirst({
      where: eq(issues.id, input.issueId),
    });

    if (!issueRecord) {
      throw new AppError('NOT_FOUND', `Issue / Finding ${input.issueId} not found`, 404);
    }

    // Update Issue status to 'investigating'
    await this.db.update(issues).set({
      status: 'investigating',
      updatedAt: new Date(),
    }).where(eq(issues.id, input.issueId));

    // 3. Perform or Fetch AI Root Cause Analysis if not present
    let rca: RootCauseAnalysisOutput | null = (issueRecord.rootCauseAnalysis as RootCauseAnalysisOutput) || null;
    if (!rca) {
      try {
        rca = await this.rootCauseAnalysisService.analyzeIssue(input.issueId);
      } catch {
        rca = null;
      }
    }

    // 4. Set up Task Branch on GitHub if repository config provided
    if (input.githubRepo && this.githubService) {
      try {
        await this.githubService.createTaskBranch(
          input.githubRepo.owner,
          input.githubRepo.repo,
          input.branchName,
          input.githubRepo.defaultBranch || 'main',
          input.githubRepo.token,
          input.githubRepo.baseUrl
        );
      } catch (err: any) {
        // If branch already exists (409), log and proceed safely
        if (!err.message?.toLowerCase().includes('already exists')) {
          // If other permission error, rethrow or proceed with local runner
        }
      }
    }

    // 5. Bounded Self-Fixing Attempt Loop (Max 3 attempts)
    const attempts: SelfFixAttemptRecord[] = [];
    const seenPatchSignatures = new Set<string>();
    let winningAttempt: number | null = null;
    let createdPullRequest: any = null;
    let isSuccess = false;

    for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
      try {
        // Step 5a: Generate AI Code Fix Proposal
        AuditLoggerService.log('SELF_FIX_ATTEMPT_STARTED', `Started fix attempt ${attemptNum}/${maxAttempts}`, 'in_progress', input.issueId, { attemptNum, branch: input.branchName });

        const fixProposal = await this.codeFixService.generateFixProposal(input.issueId, {
          branchName: input.branchName,
          files: input.files || [],
          githubRepo: input.githubRepo,
        });

        // Step 5b: Deduplication Check against previously failed patches
        const signature = this.calculatePatchSignature(fixProposal.fileChanges || []);
        if (seenPatchSignatures.has(signature)) {
          AuditLoggerService.log('SELF_FIX_ATTEMPT_DUPLICATE', `Attempt ${attemptNum} generated duplicate patch proposal. Skipped execution.`, 'skipped', input.issueId, { attemptNum, signature });
          const duplicateRecord: SelfFixAttemptRecord = {
            attemptNumber: attemptNum,
            fixProposal,
            testResult: {
              passed: false,
              failedCommands: ['patch-deduplication-check'],
              logsSummary: `Attempt ${attemptNum} generated an identical patch proposal to a previously failed attempt. Skipping execution.`,
              durationMs: 0,
              affectedBranch: input.branchName,
              issueId: input.issueId,
              testSuitesRun: [],
            },
            status: 'rejected_duplicate',
            patchSignature: signature,
            timestamp: new Date().toISOString(),
            errorDetails: 'Identical patch proposal generated previously in this loop.',
          };
          attempts.push(duplicateRecord);
          continue;
        }

        seenPatchSignatures.add(signature);

        // Step 5c: Apply Changes & Commit on Task Branch (if GitHub config supplied)
        let commitResult: any = undefined;
        if (input.githubRepo && this.githubService) {
          const fileChanges = fixProposal.fileChanges.map(c => ({
            path: c.path,
            content: c.newContent,
            operation: ('update' as const),
          }));

          commitResult = await this.githubService.applyFileChanges({
            owner: input.githubRepo.owner,
            repo: input.githubRepo.repo,
            branch: input.branchName,
            commitMessage: `fix(agentops): attempt ${attemptNum} - ${fixProposal.explanation}`,
            changes: fileChanges,
            token: input.githubRepo.token,
            baseUrl: input.githubRepo.baseUrl,
          });
        }

        // Step 5d: Run Automated Test Runner
        const testResult = await this.fixTestRunnerService.runTests({
          branchName: input.branchName,
          issueId: input.issueId,
          suiteTypes: input.suiteTypes || ['unit', 'integration', 'changed_area_regression'],
          changedFiles: fixProposal.changedFiles,
        });

        const attemptRecord: SelfFixAttemptRecord = {
          attemptNumber: attemptNum,
          fixProposal,
          testResult,
          commitResult,
          status: testResult.passed ? 'passed' : 'failed',
          patchSignature: signature,
          timestamp: new Date().toISOString(),
        };

        attempts.push(attemptRecord);

        if (testResult.passed) {
          AuditLoggerService.log('SELF_FIX_ATTEMPT_PASSED', `Fix attempt ${attemptNum} passed test suite checks`, 'success', input.issueId, { attemptNum, branch: input.branchName });
        } else {
          AuditLoggerService.log('SELF_FIX_ATTEMPT_FAILED', `Fix attempt ${attemptNum} failed test suite checks`, 'failure', input.issueId, { attemptNum, failedCommands: testResult.failedCommands });
        }

        // Step 5e: Evaluate Test Results & Handle Immediate Success
        if (testResult.passed) {
          isSuccess = true;
          winningAttempt = attemptNum;

          // Update DB issue status to 'fixed'
          await this.db.update(issues).set({
            status: 'fixed',
            updatedAt: new Date(),
          }).where(eq(issues.id, input.issueId));

          // Create Pull Request if GitHub integration enabled
          if (input.githubRepo && this.githubService) {
            try {
              const inferenceArray = typeof rca?.inference === 'string'
                ? [rca.inference]
                : (rca?.inference || []);

              createdPullRequest = await this.githubService.createPullRequest({
                owner: input.githubRepo.owner,
                repo: input.githubRepo.repo,
                head: input.branchName,
                base: input.githubRepo.defaultBranch || 'main',
                title: `fix: ${issueRecord.title}`,
                findingSummary: {
                  title: issueRecord.title,
                  severity: issueRecord.severity,
                  description: issueRecord.description || 'No description',
                  expectedResult: issueRecord.expectedResult || undefined,
                  actualResult: issueRecord.actualResult || undefined,
                },
                rootCauseAnalysis: rca ? {
                  likelyCause: rca.likelyCause,
                  suspectedFileOrComponent: rca.suspectedComponent || undefined,
                  recommendedAction: rca.recommendedNextAction,
                  facts: rca.facts,
                  inference: inferenceArray,
                } : undefined,
                testRunnerResult: {
                  passed: testResult.passed,
                  durationMs: testResult.durationMs,
                  failedCommands: testResult.failedCommands,
                  testSuitesRun: testResult.testSuitesRun.map(s => ({
                    name: s.command || s.type,
                    passed: s.passed,
                    logsSummary: s.errorSummary || s.stdoutSnippet,
                  })),
                },
                token: input.githubRepo.token,
                baseUrl: input.githubRepo.baseUrl,
              });
            } catch {
              // Ignore PR creation failure if tests already passed
            }
          }

          AuditLoggerService.log('SELF_FIX_COMPLETED', `Self-fixing loop completed successfully on attempt ${winningAttempt}`, 'success', input.issueId, { winningAttempt, branch: input.branchName });
          // STOP IMMEDIATELY ON SUCCESS
          break;
        }
      } catch (err: any) {
        attempts.push({
          attemptNumber: attemptNum,
          fixProposal: {
            issueId: input.issueId,
            targetBranch: input.branchName,
            explanation: `Attempt ${attemptNum} failed with execution error: ${err.message}`,
            changedFiles: [],
            fileChanges: [],
            riskNotes: [err.message],
          },
          testResult: {
            passed: false,
            failedCommands: ['attempt-error'],
            logsSummary: err.message || 'Execution error during fix attempt',
            durationMs: 0,
            affectedBranch: input.branchName,
            issueId: input.issueId,
            testSuitesRun: [],
          },
          status: 'error',
          patchSignature: `error_${attemptNum}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          errorDetails: err.message,
        });
      }
    }

    // 6. Final Result Construction & Escalation
    if (isSuccess) {
      return {
        issueId: input.issueId,
        branchName: input.branchName,
        success: true,
        status: 'fixed',
        winningAttempt,
        totalAttempts: attempts.length,
        pullRequest: createdPullRequest,
        attempts,
        rootCauseAnalysis: rca,
      };
    }

    // Escalated to Human Engineer after max attempts
    const escalationReason = `Maximum fix attempts (${maxAttempts}) reached on branch '${input.branchName}' without passing all required test suites. Escalated to human engineer.`;
    const escalationSummary = this.formatEscalationSummary(issueRecord.title, rca, attempts);

    AuditLoggerService.log('SELF_FIX_ESCALATED', `Self-fixing loop exhausted ${maxAttempts} attempts without success. Escalated to human engineer.`, 'failure', input.issueId, { totalAttempts: attempts.length, branch: input.branchName });


    return {
      issueId: input.issueId,
      branchName: input.branchName,
      success: false,
      status: 'escalated',
      winningAttempt: null,
      totalAttempts: attempts.length,
      pullRequest: null,
      attempts,
      rootCauseAnalysis: rca,
      escalationReason,
      escalationSummary,
    };
  }
}
