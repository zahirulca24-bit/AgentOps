import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import type { Database } from '../../infrastructure/db/client.js';
import type { BrowserManager } from '../../infrastructure/browser/browser.manager.js';
import type { EnvConfig } from '../../config/env.js';
import { projects, tasks, runs, testCases, testResults, issues, evidence } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import type { TestStep, TestAssertion } from '../generator/generator.schema.js';
import { broadcastRunEvent } from './execution.routes.js';
import { EvidenceService } from '../evidence/evidence.service.js';
import { SeverityClassifierService } from '../severity/severity.service.js';
import { deriveExecutionRootCause, type ExecutionRootCause } from './root-cause.js';
import {
  normalizeAbsoluteTargetUrl,
  resolveEffectiveTargetUrl,
  resolveNavigationUrl,
} from './target-url.js';

export class ExecutionService {
  private activeCancelledRuns = new Set<string>();
  private evidenceService: EvidenceService;
  private severityClassifier: SeverityClassifierService;

  constructor(
    private db: Database,
    private browserManager: BrowserManager,
    private config: EnvConfig
  ) {
    this.evidenceService = new EvidenceService(config);
    this.severityClassifier = new SeverityClassifierService();
  }

  public async cancelRun(runId: string): Promise<void> {
    const runRecord = await this.db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    if (runRecord.length === 0) {
      throw new AppError('NOT_FOUND', `Run ${runId} not found`, 404);
    }

    this.activeCancelledRuns.add(runId);
    await this.db.update(runs).set({ status: 'stopped', completedAt: new Date() }).where(eq(runs.id, runId));

    const taskId = runRecord[0]?.taskId;
    if (taskId) {
      await this.db.update(tasks).set({ status: 'failed', updatedAt: new Date() }).where(eq(tasks.id, taskId));
    }

    broadcastRunEvent(runId, 'run_cancelled', { runId, status: 'stopped', message: 'Run was cancelled by user' });
  }

  private async resolveRunTargetUrl(run: any, cases: any[]): Promise<string> {
    let taskRecord: any = null;
    let projectRecord: any = null;

    if (run?.taskId && this.db.query?.tasks) {
      taskRecord = await this.db.query.tasks.findFirst({ where: eq(tasks.id, run.taskId) });
    }

    if (taskRecord?.projectId && this.db.query?.projects) {
      projectRecord = await this.db.query.projects.findFirst({ where: eq(projects.id, taskRecord.projectId) });
    }

    try {
      return resolveEffectiveTargetUrl({
        taskTargetUrl: taskRecord?.targetUrl,
        projectTargetUrl: projectRecord?.targetUrl,
        command: taskRecord?.command,
      });
    } catch (error) {
      // Backwards-compatible recovery for old persisted test cases and focused
      // execution tests that predate canonical task/project URL propagation.
      const legacyTarget = cases
        .flatMap((tCase: any) => Array.isArray(tCase.steps) ? tCase.steps : [])
        .find((step: any) => step?.action === 'navigate' && /^https?:\/\//i.test(step?.target || ''))
        ?.target;

      if (legacyTarget) return normalizeAbsoluteTargetUrl(legacyTarget);
      throw error;
    }
  }

  private async listRunIssues(runId: string): Promise<any[]> {
    if (this.db.query?.issues?.findMany) {
      return this.db.query.issues.findMany({ where: eq(issues.runId, runId) });
    }
    return this.db.select().from(issues).where(eq(issues.runId, runId));
  }

  private async upsertRootIssue(options: {
    runId: string;
    root: ExecutionRootCause;
    errorMessage: string;
    testResultId?: string | null;
    testName?: string | null;
    browserSessionId?: string | null;
    affectedUrl?: string | null;
    screenshotRef?: string | null;
    reproductionSteps?: string[];
    expectedResult?: string;
  }): Promise<any> {
    const existingIssues = await this.listRunIssues(options.runId);
    const existing = existingIssues.find((issue: any) =>
      issue?.rootCauseAnalysis?.rootCauseKey === options.root.key
    );

    const currentAnalysis = existing?.rootCauseAnalysis || {};
    const existingResultIds = Array.isArray(currentAnalysis.symptomTestResultIds)
      ? currentAnalysis.symptomTestResultIds
      : [];
    const existingNames = Array.isArray(currentAnalysis.symptomNames)
      ? currentAnalysis.symptomNames
      : [];

    const symptomTestResultIds = options.testResultId
      ? Array.from(new Set([...existingResultIds, options.testResultId]))
      : existingResultIds;
    const symptomNames = options.testName
      ? Array.from(new Set([...existingNames, options.testName]))
      : existingNames;
    const symptomCount = Math.max(
      Number(currentAnalysis.symptomCount || 0) + (existing ? 1 : 0),
      symptomTestResultIds.length,
      symptomNames.length,
      1,
    );

    const rootCauseAnalysis = {
      ...currentAnalysis,
      rootCauseKey: options.root.key,
      likelyCause: options.root.likelyCause,
      confidence: 'high',
      affectedArea: options.root.affectedArea,
      recommendedNextAction: options.root.recommendedNextAction,
      facts: Array.from(new Set([
        ...(Array.isArray(currentAnalysis.facts) ? currentAnalysis.facts : []),
        options.errorMessage,
      ])).slice(0, 20),
      inference: options.root.likelyCause,
      symptomCount,
      symptomTestResultIds,
      symptomNames,
    };

    if (existing) {
      await this.db.update(issues).set({
        description: `${options.root.likelyCause} (${symptomCount} observed symptom${symptomCount === 1 ? '' : 's'} in this run)`,
        actualResult: options.errorMessage,
        affectedUrl: options.affectedUrl || existing.affectedUrl,
        screenshotEvidence: options.screenshotRef
          ? Array.from(new Set([...(Array.isArray(existing.screenshotEvidence) ? existing.screenshotEvidence : []), options.screenshotRef]))
          : existing.screenshotEvidence,
        rootCauseAnalysis,
        updatedAt: new Date(),
      }).where(eq(issues.id, existing.id));

      return { ...existing, rootCauseAnalysis };
    }

    const classification = this.severityClassifier.classify({
      title: options.root.title,
      description: options.root.likelyCause,
      category: 'functional',
      errorMessage: options.errorMessage,
      actualResult: options.errorMessage,
      affectedUrl: options.affectedUrl || undefined,
      userFlowImpact: 'blocking',
    });

    const [createdIssue] = await this.db.insert(issues).values({
      runId: options.runId,
      testResultId: options.testResultId || null,
      browserSessionId: options.browserSessionId || null,
      title: options.root.title,
      description: options.root.likelyCause,
      severity: classification.severity,
      severityReason: classification.reason,
      category: 'functional',
      status: 'open',
      reproductionSteps: options.reproductionSteps || ['Execute the QA run using the configured target URL'],
      expectedResult: options.expectedResult || 'QA execution uses one valid canonical target URL',
      actualResult: options.errorMessage,
      screenshotEvidence: options.screenshotRef ? [options.screenshotRef] : [],
      affectedUrl: options.affectedUrl || null,
      rootCauseAnalysis,
    }).returning();

    broadcastRunEvent(options.runId, 'issue_created', {
      runId: options.runId,
      issueId: createdIssue?.id,
      title: options.root.title,
      rootCauseKey: options.root.key,
    });

    return createdIssue;
  }

  public async executeRun(runId: string): Promise<void> {
    const runRecord = await this.db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    if (runRecord.length === 0) {
      throw new AppError('NOT_FOUND', `Run ${runId} not found`, 404);
    }
    const run = runRecord[0];

    if (run.status === 'running' || run.status === 'passed' || run.status === 'failed' || run.status === 'stopped') {
      throw new AppError('CONFLICT', `Run ${runId} is already in state ${run.status}`, 409);
    }

    await this.db.update(runs).set({ status: 'running' }).where(eq(runs.id, runId));
    broadcastRunEvent(runId, 'run_started', { runId, status: 'running' });

    const cases = await this.db.select().from(testCases).where(eq(testCases.runId, runId));
    let runStatus: 'passed' | 'failed' | 'error' | 'stopped' = cases.length === 0 ? 'passed' : 'passed';
    let effectiveTargetUrl: string | undefined;
    let session: any;
    let passedCount = 0;
    let failedCount = 0;

    try {
      try {
        effectiveTargetUrl = await this.resolveRunTargetUrl(run, cases);
      } catch (error: any) {
        runStatus = 'error';
        const message = error?.message || 'Target URL is missing or malformed';
        await this.upsertRootIssue({
          runId,
          root: deriveExecutionRootCause(message),
          errorMessage: message,
          affectedUrl: null,
        });
        return;
      }

      if (cases.length === 0) return;

      session = await this.browserManager.createSession(runId, this.db);

      for (const tCase of cases) {
        if (this.activeCancelledRuns.has(runId)) {
          runStatus = 'stopped';
          break;
        }

        let testStatus: 'passed' | 'failed' | 'error' | 'stopped' = 'passed';
        let errorMessage: string | undefined;
        let screenshotRef: string | undefined;
        const assertionResults: any[] = [];
        const startTime = Date.now();

        broadcastRunEvent(runId, 'test_started', { runId, testCaseId: tCase.id, name: tCase.name });

        try {
          const steps = tCase.steps as unknown as TestStep[];
          const assertions = tCase.assertions as unknown as TestAssertion[];

          await session.navigate({ url: 'about:blank' });

          for (const step of steps) {
            if (this.activeCancelledRuns.has(runId)) {
              testStatus = 'stopped';
              break;
            }

            broadcastRunEvent(runId, 'step_executing', { runId, testCaseId: tCase.id, action: step.action });

            switch (step.action) {
              case 'navigate':
                await session.navigate({ url: resolveNavigationUrl(step.target, effectiveTargetUrl) });
                break;
              case 'click':
                if (step.target) await session.click({ selector: step.target });
                break;
              case 'fill':
                if (step.target && step.value) await session.fill({ selector: step.target, value: step.value });
                break;
              case 'select':
                if (step.target && step.value) await session.select({ selector: step.target, value: step.value });
                break;
              case 'scroll':
                await session.scroll({ direction: step.value as any || 'down' });
                break;
              case 'wait':
                await session.wait({ timeoutMs: step.value ? parseInt(step.value) : 1000 });
                break;
              default:
                throw new Error(`Unsupported action: ${step.action}`);
            }
          }

          if (testStatus === 'stopped') {
            // Do not continue assertions after cancellation.
          } else {
            const visualDefects = await session.evaluateVisualQA();
            if (visualDefects.length > 0) {
              for (const defect of visualDefects) {
                const message = defect.description || defect.title;
                const root = deriveExecutionRootCause(`Visual layout failure: ${message}`);
                await this.upsertRootIssue({
                  runId,
                  root: { ...root, title: `Visual Defect: ${defect.title}`, affectedArea: 'Visual layout' },
                  errorMessage: message,
                  browserSessionId: session.sessionId,
                  affectedUrl: effectiveTargetUrl,
                  reproductionSteps: [`Navigate to ${effectiveTargetUrl}`, `Inspect visual layout of element: ${defect.selector || 'page'}`],
                  expectedResult: 'Element renders correctly without layout defects',
                });
              }
            }

            for (const assertion of assertions) {
              if (this.activeCancelledRuns.has(runId)) {
                testStatus = 'stopped';
                break;
              }

              const result = await session.evaluateAssertion(assertion.type, assertion.target, assertion.expected);
              assertionResults.push({ ...assertion, ...result });

              if (!result.pass) {
                testStatus = 'failed';
                errorMessage = `Assertion failed: ${assertion.type} - actual: ${result.actual}`;

                try {
                  const snap = await session.screenshot({ fullPage: true });
                  if (snap.storageRef && (await fs.stat(snap.storageRef).catch(() => null))) {
                    const imageBuffer = await fs.readFile(snap.storageRef);
                    const evidenceMeta = await this.evidenceService.storeEvidence({
                      filename: `screenshot_${tCase.id}.png`,
                      contentType: 'image/png',
                      content: imageBuffer,
                      runId,
                      testCaseId: tCase.id,
                    });
                    screenshotRef = evidenceMeta.id;
                  }
                } catch {}
                break;
              }
            }
          }
        } catch (err: any) {
          testStatus = 'error';
          errorMessage = err?.message || 'Unknown execution error';
        }

        const durationMs = Date.now() - startTime;
        const [insertedResult] = await this.db.insert(testResults).values({
          runId,
          testCaseId: tCase.id,
          name: tCase.name,
          status: testStatus,
          durationMs,
          summary: testStatus === 'passed' ? 'All assertions passed' : errorMessage || `Test ${testStatus}`,
          errorMessage,
          screenshotRef,
          assertions: assertionResults,
        }).returning();

        let rootIssue: any = null;
        if ((testStatus === 'failed' || testStatus === 'error') && errorMessage) {
          const rawSteps = tCase.steps as unknown as TestStep[];
          const reproSteps = Array.isArray(rawSteps)
            ? rawSteps.map(s => `${s.action} ${s.action === 'navigate' ? resolveNavigationUrl(s.target, effectiveTargetUrl!) : (s.target || '')} ${s.value || ''}`.trim())
            : [`Execute test case ${tCase.name}`];

          rootIssue = await this.upsertRootIssue({
            runId,
            root: deriveExecutionRootCause(errorMessage),
            errorMessage,
            testResultId: insertedResult?.id || null,
            testName: tCase.name,
            browserSessionId: session?.sessionId || null,
            affectedUrl: effectiveTargetUrl,
            screenshotRef,
            reproductionSteps: reproSteps,
            expectedResult: tCase.assertions ? JSON.stringify(tCase.assertions) : 'All test assertions pass',
          });
        }

        if (screenshotRef) {
          try {
            await this.db.insert(evidence).values({
              runId,
              testResultId: insertedResult?.id || null,
              issueId: rootIssue?.id || null,
              type: 'screenshot',
              storageRef: screenshotRef,
              description: `Failure screenshot for test ${tCase.name}`,
            });
          } catch {}
        }

        broadcastRunEvent(runId, 'test_completed', {
          runId,
          testCaseId: tCase.id,
          name: tCase.name,
          status: testStatus,
          errorMessage,
          durationMs,
        });

        if (testStatus === 'passed') passedCount += 1;
        if (testStatus === 'failed' || testStatus === 'error') failedCount += 1;

        if (testStatus === 'failed' && runStatus !== 'error' && runStatus !== 'stopped') {
          runStatus = 'failed';
        } else if (testStatus === 'error' && runStatus !== 'stopped') {
          runStatus = 'error';
        } else if (testStatus === 'stopped') {
          runStatus = 'stopped';
        }
      }
    } catch (err: any) {
      if (runStatus !== 'stopped') runStatus = 'error';
      const message = err?.message || 'Unexpected QA execution failure';
      try {
        await this.upsertRootIssue({
          runId,
          root: deriveExecutionRootCause(message),
          errorMessage: message,
          browserSessionId: session?.sessionId || null,
          affectedUrl: effectiveTargetUrl || null,
        });
      } catch {}
    } finally {
      if (session) {
        try {
          const logs = session.getLogs();
          if (logs.console.length > 0) {
            const consoleMeta = await this.evidenceService.storeEvidence({
              filename: `console_log_${runId}.json`,
              contentType: 'application/json',
              content: JSON.stringify(logs.console, null, 2),
              runId,
            });
            await this.db.insert(evidence).values({
              runId,
              type: 'console_log',
              storageRef: consoleMeta.id,
              description: 'Console log output captured during execution',
            });
          }

          if (logs.network.length > 0) {
            const networkMeta = await this.evidenceService.storeEvidence({
              filename: `network_log_${runId}.json`,
              contentType: 'application/json',
              content: JSON.stringify(logs.network, null, 2),
              runId,
            });
            await this.db.insert(evidence).values({
              runId,
              type: 'network_log',
              storageRef: networkMeta.id,
              description: 'Network activity captured during execution',
            });
          }
        } catch {}

        try {
          await this.browserManager.closeSession(session.sessionId, this.db);
        } catch {}
      }

      const finalStatus: 'passed' | 'failed' | 'error' | 'stopped' = this.activeCancelledRuns.has(runId)
        ? 'stopped'
        : runStatus;
      const completedAt = new Date();

      await this.db.update(runs).set({
        status: finalStatus,
        completedAt,
      }).where(eq(runs.id, runId));

      if (run.taskId) {
        await this.db.update(tasks).set({
          status: finalStatus === 'passed' ? 'completed' : 'failed',
          updatedAt: completedAt,
        }).where(eq(tasks.id, run.taskId));
      }

      // Every completed execution emits one durable machine-readable run report.
      // The Reports UI reads this same run/evidence data; no mock report state is introduced.
      try {
        const reportMeta = await this.evidenceService.storeEvidence({
          filename: `run_report_${runId}.json`,
          contentType: 'application/json',
          content: JSON.stringify({
            runId,
            targetUrl: effectiveTargetUrl || null,
            status: finalStatus,
            passedTests: passedCount,
            failedTests: failedCount,
            completedAt: completedAt.toISOString(),
          }, null, 2),
          runId,
        });
        await this.db.insert(evidence).values({
          runId,
          type: 'run_report',
          storageRef: reportMeta.id,
          description: 'Final QA execution report generated from run state',
        });
      } catch {}

      broadcastRunEvent(runId, 'run_completed', {
        runId,
        status: finalStatus,
        targetUrl: effectiveTargetUrl || null,
        passedTests: passedCount,
        failedTests: failedCount,
      });
      this.activeCancelledRuns.delete(runId);
    }
  }
}
