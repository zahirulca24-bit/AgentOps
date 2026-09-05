import { eq } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
import { issues, runs, testResults, browserSessions, evidence } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { wrapUntrustedUserPrompt } from '../../core/ai/promptGuard.js';
import {
  rootCauseAnalysisSchema,
  rootCauseAnalysisJsonSchema,
  type RootCauseAnalysisOutput,
} from './analysis.schema.js';

export interface AnalysisInputContext {
  issueId: string;
}

export class RootCauseAnalysisService {
  constructor(
    private db: Database,
    private aiProvider: AIProvider
  ) {}

  public async analyzeIssue(issueId: string): Promise<RootCauseAnalysisOutput> {
    // 1. Fetch Issue with linked relations
    const issueRecord = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        evidence: true,
        testResult: true,
        browserSession: true,
      }
    });

    if (!issueRecord) {
      throw new AppError('NOT_FOUND', `Issue ${issueId} not found`, 404);
    }

    // 2. Fetch associated Run context
    const runRecord = await this.db.query.runs.findFirst({
      where: eq(runs.id, issueRecord.runId),
    });

    // 3. Fetch evidence logs associated with the run / issue
    const evidenceList = await this.db.query.evidence.findMany({
      where: eq(evidence.runId, issueRecord.runId),
    });

    const consoleLogs = evidenceList.filter((e: any) => e.type === 'console_log').map((e: any) => e.description || e.storageRef);
    const networkLogs = evidenceList.filter((e: any) => e.type === 'network_log').map((e: any) => e.description || e.storageRef);
    const screenshots = evidenceList.filter((e: any) => e.type === 'screenshot').map((e: any) => e.storageRef);

    // 4. Construct Structured Context object
    const analysisContext = {
      finding: {
        id: issueRecord.id,
        title: issueRecord.title,
        description: issueRecord.description,
        severity: issueRecord.severity,
        severityReason: issueRecord.severityReason,
        category: issueRecord.category,
        status: issueRecord.status,
        affectedUrl: issueRecord.affectedUrl,
        reproductionSteps: issueRecord.reproductionSteps,
        expectedResult: issueRecord.expectedResult,
        actualResult: issueRecord.actualResult,
      },
      failedTest: issueRecord.testResult ? {
        id: issueRecord.testResult.id,
        name: issueRecord.testResult.name,
        status: issueRecord.testResult.status,
        errorMessage: issueRecord.testResult.errorMessage,
        summary: issueRecord.testResult.summary,
        durationMs: issueRecord.testResult.durationMs,
        assertions: issueRecord.testResult.assertions,
      } : null,
      consoleErrors: consoleLogs.length > 0 ? consoleLogs : ['No explicit JS console exceptions recorded'],
      networkFailures: networkLogs.length > 0 ? networkLogs : ['No HTTP 4xx/5xx network failures recorded'],
      evidenceReferences: {
        screenshots: issueRecord.screenshotEvidence || screenshots,
        console: issueRecord.consoleEvidence || consoleLogs,
        network: issueRecord.networkEvidence || networkLogs,
      },
      sessionContext: {
        runId: issueRecord.runId,
        browserSessionId: issueRecord.browserSessionId,
        runStatus: runRecord?.status,
        startedAt: runRecord?.startedAt,
      }
    };

    // 5. Build prompt with prompt injection protection
    const safeFindingTitle = wrapUntrustedUserPrompt(issueRecord.title);
    const safeDescription = wrapUntrustedUserPrompt(issueRecord.description || 'No description');
    const safeActualResult = wrapUntrustedUserPrompt(issueRecord.actualResult || 'None');

    const promptText = `You are an expert Autonomous Root-Cause Analysis Diagnostic System.
Analyze the following QA failure details and produce a structured root-cause analysis.

CRITICAL INSTRUCTIONS:
- Keep the output bounded and structured according to the response schema.
- You MUST clearly separate empirical observed facts (stored in "facts") from AI diagnostic deductions (stored in "inference").
- Do NOT generate code edits or suggest automatic code execution.
- Be objective and specific about the suspected file/component/API endpoint when evident.

FINDING DETAILS:
- Title: ${safeFindingTitle}
- Category: ${issueRecord.category || 'N/A'}
- Severity: ${issueRecord.severity} (${issueRecord.severityReason || 'N/A'})
- Description: ${safeDescription}
- Actual Result: ${safeActualResult}
- Expected Result: ${issueRecord.expectedResult || 'N/A'}

FAILED TEST CONTEXT:
${analysisContext.failedTest ? JSON.stringify(analysisContext.failedTest, null, 2) : 'No direct linked test case'}

CONSOLE LOG EVIDENCE:
${JSON.stringify(analysisContext.consoleErrors, null, 2)}

NETWORK FAILURE EVIDENCE:
${JSON.stringify(analysisContext.networkFailures, null, 2)}

RUN & SESSION CONTEXT:
${JSON.stringify(analysisContext.sessionContext, null, 2)}`;

    // 6. Invoke AI Provider
    const rawOutput = await this.aiProvider.generateStructuredQA<any>(
      {
        taskCommand: `Root Cause Analysis for finding: ${issueRecord.title}`,
        targetUrl: issueRecord.affectedUrl,
        promptOverride: promptText,
        analysisContext,
      },
      rootCauseAnalysisJsonSchema
    );

    // 7. Validate output against Zod schema
    const parseResult = rootCauseAnalysisSchema.safeParse(rawOutput);
    if (!parseResult.success) {
      throw new AppError('INTERNAL_ERROR', 'AI generated invalid root-cause analysis structure', 500);
    }

    const analysisOutput = parseResult.data;

    // 8. Persist analysis into DB issues record
    await this.db.update(issues).set({
      rootCauseAnalysis: analysisOutput,
      updatedAt: new Date(),
    }).where(eq(issues.id, issueId));

    return analysisOutput;
  }
}
