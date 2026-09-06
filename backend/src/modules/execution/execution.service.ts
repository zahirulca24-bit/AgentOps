import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import type { Database } from '../../infrastructure/db/client.js';
import type { BrowserManager } from '../../infrastructure/browser/browser.manager.js';
import type { EnvConfig } from '../../config/env.js';
import { runs, testCases, testResults, issues, evidence } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import type { TestStep, TestAssertion } from '../generator/generator.schema.js';
import { broadcastRunEvent } from './execution.routes.js';
import { EvidenceService } from '../evidence/evidence.service.js';
import { SeverityClassifierService } from '../severity/severity.service.js';

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

    broadcastRunEvent(runId, 'run_cancelled', { runId, status: 'stopped', message: 'Run was cancelled by user' });
  }

  public async executeRun(runId: string): Promise<void> {
    // 1. Validate run state (concurrency check)
    const runRecord = await this.db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    if (runRecord.length === 0) {
      throw new AppError('NOT_FOUND', `Run ${runId} not found`, 404);
    }
    const run = runRecord[0];
    
    if (run.status === 'running' || run.status === 'passed' || run.status === 'failed' || run.status === 'stopped') {
      throw new AppError('CONFLICT', `Run ${runId} is already in state ${run.status}`, 409);
    }

    // Mark as running
    await this.db.update(runs).set({ status: 'running' }).where(eq(runs.id, runId));
    broadcastRunEvent(runId, 'run_started', { runId, status: 'running' });

    const cases = await this.db.select().from(testCases).where(eq(testCases.runId, runId));
    let runStatus: 'passed' | 'failed' | 'error' | 'stopped' = 'passed';

    let session;
    try {
      // Create session with DB tracking
      session = await this.browserManager.createSession(runId, this.db);

      for (const tCase of cases) {
        // Check cancellation
        if (this.activeCancelledRuns.has(runId)) {
          runStatus = 'stopped';
          break;
        }

        let testStatus: 'passed' | 'failed' | 'error' | 'stopped' = 'passed';
        let errorMessage: string | undefined;
        let screenshotRef: string | undefined;
        let assertionResults: any[] = [];
        const startTime = Date.now();

        broadcastRunEvent(runId, 'test_started', { runId, testCaseId: tCase.id, name: tCase.name });

        try {
          const steps = tCase.steps as unknown as TestStep[];
          const assertions = tCase.assertions as unknown as TestAssertion[];

          await session.navigate({ url: 'about:blank' });

          // Execute Actions
          for (const step of steps) {
            if (this.activeCancelledRuns.has(runId)) {
              testStatus = 'stopped';
              break;
            }

            broadcastRunEvent(runId, 'step_executing', { runId, testCaseId: tCase.id, action: step.action });

            switch (step.action) {
              case 'navigate':
                if (step.target) await session.navigate({ url: step.target });
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

          // Evaluate Visual QA layout checks
          const visualDefects = await session.evaluateVisualQA();
          if (visualDefects.length > 0) {
            for (const defect of visualDefects) {
              try {
                const title = `Visual Defect: ${defect.title}`;
                const description = `${defect.description}${defect.selector ? ` Selector: ${defect.selector}` : ''}`;
                const classification = this.severityClassifier.classify({
                  title,
                  description,
                  category: 'visual',
                  userFlowImpact: defect.severity === 'high' ? 'degraded' : 'minor',
                  actualResult: defect.description,
                });

                await this.db.insert(issues).values({
                  runId,
                  browserSessionId: session.sessionId,
                  title,
                  description,
                  severity: classification.severity,
                  severityReason: classification.reason,
                  category: 'visual',
                  status: 'open',
                  reproductionSteps: [`Navigate to target page`, `Inspect visual layout of element: ${defect.selector || 'page'}`],
                  expectedResult: 'Element renders correctly without layout defects',
                  actualResult: defect.description,
                  screenshotEvidence: screenshotRef ? [screenshotRef] : [],
                });
                broadcastRunEvent(runId, 'issue_created', { runId, title: defect.title, category: 'visual' });
              } catch (err) {}
            }
          }

          // Evaluate Assertions
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
              
              // Capture failure screenshot and store in EvidenceService
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
              } catch (e) {}
              break;
            }
          }

        } catch (err: any) {
           if (err.name === 'AppError' && (err.code === 'NAVIGATION_BLOCKED' || err.code === 'ACTION_FAILED')) {
              testStatus = 'error';
           } else {
              testStatus = 'error';
           }
           errorMessage = err.message;
        }

        const durationMs = Date.now() - startTime;

        // Persist test result
        const [insertedResult] = await this.db.insert(testResults).values({
          runId,
          testCaseId: tCase.id,
          name: tCase.name,
          status: testStatus,
          durationMs,
          summary: testStatus === 'passed' ? 'All assertions passed' : errorMessage,
          errorMessage,
          screenshotRef,
          assertions: assertionResults,
        }).returning();

        // Save screenshot as evidence record in DB if created
        if (screenshotRef) {
          try {
            await this.db.insert(evidence).values({
              runId,
              testResultId: insertedResult?.id || null,
              type: 'screenshot',
              storageRef: screenshotRef,
              description: `Failure screenshot for test ${tCase.name}`,
            });
          } catch (e) {}
        }

        // Auto-create Issue for failed/error test result
        if (testStatus === 'failed' || testStatus === 'error') {
          try {
            const rawSteps = tCase.steps as unknown as TestStep[];
            const reproSteps = Array.isArray(rawSteps)
              ? rawSteps.map(s => `${s.action} ${s.target || ''} ${s.value || ''}`.trim())
              : [`Execute test case ${tCase.name}`];

            const title = `${testStatus === 'error' ? 'Execution Error' : 'Test Failed'}: ${tCase.name}`;
            const description = errorMessage || `Test ${tCase.name} encountered an issue during execution.`;
            const classification = this.severityClassifier.classify({
              title,
              description,
              category: 'functional',
              errorMessage,
              actualResult: errorMessage || `${testStatus === 'error' ? 'Execution error' : 'Assertion failed'}`,
              userFlowImpact: testStatus === 'error' ? 'blocking' : 'blocking',
            });

            const [createdIssue] = await this.db.insert(issues).values({
              runId,
              testResultId: insertedResult?.id || null,
              browserSessionId: session ? session.sessionId : null,
              title,
              description,
              severity: classification.severity,
              severityReason: classification.reason,
              category: 'functional',
              status: 'open',
              reproductionSteps: reproSteps,
              expectedResult: tCase.assertions ? JSON.stringify(tCase.assertions) : 'All test assertions pass',
              actualResult: errorMessage || `${testStatus === 'error' ? 'Execution error' : 'Assertion failed'}`,
              screenshotEvidence: screenshotRef ? [screenshotRef] : [],
            }).returning();

            broadcastRunEvent(runId, 'issue_created', { runId, issueId: createdIssue?.id, title: tCase.name });
          } catch (e) {}
        }

        broadcastRunEvent(runId, 'test_completed', {
          runId,
          testCaseId: tCase.id,
          name: tCase.name,
          status: testStatus,
          errorMessage,
          durationMs,
        });

        // Update run aggregation
        if (testStatus === 'failed' && runStatus !== 'error' && (runStatus as any) !== 'stopped') {
          runStatus = 'failed';
        } else if (testStatus === 'error' && (runStatus as any) !== 'stopped') {
          runStatus = 'error';
        }
      }
    } catch (err: any) {
      if ((runStatus as any) !== 'stopped') runStatus = 'error';
    } finally {
      if (session) {
        // Save console and network logs to evidence before closing session
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
        } catch (e) {}

        await this.browserManager.closeSession(session.sessionId, this.db);
      }
      
      const finalStatus = this.activeCancelledRuns.has(runId) ? 'stopped' : runStatus;
      if (cases.length === 0 && !this.activeCancelledRuns.has(runId)) runStatus = 'passed';
      
      await this.db.update(runs).set({
        status: finalStatus,
        completedAt: new Date()
      }).where(eq(runs.id, runId));

      broadcastRunEvent(runId, 'run_completed', { runId, status: finalStatus });
      this.activeCancelledRuns.delete(runId);
    }
  }
}
