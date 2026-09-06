import { eq } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
import { issues, runs, testResults, evidence } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import { wrapUntrustedUserPrompt } from '../../core/ai/promptGuard.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';
import { GitHubService } from '../github/github.service.js';
import type { GitHubProvider } from '../github/github.provider.js';
import {
  codeFixOutputSchema,
  codeFixJsonSchema,
  type CodeFixInput,
  type CodeFixOutput,
} from './fix.schema.js';

export interface CodeFixProposalResponse extends CodeFixOutput {
  issueId: string;
  targetBranch: string;
}

export class CodeFixService {
  private githubService?: GitHubService;

  constructor(
    private db: Database,
    private aiProvider: AIProvider,
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
        `Direct code changes to default branch '${trimmed}' are strictly blocked. Every code change must use a dedicated task branch (e.g. agentops/task-101).`,
        403
      );
    }
  }

  public async generateFixProposal(issueId: string, input: CodeFixInput): Promise<CodeFixProposalResponse> {
    // 1. Enforce Mandatory Task Branch Policy (Block direct main edits)
    this.validateTaskBranchPolicy(input.branchName);

    // 2. Fetch Confirmed Finding & Linked Relations
    const issueRecord = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        testResult: true,
        evidence: true,
      }
    });

    if (!issueRecord) {
      throw new AppError('NOT_FOUND', `Confirmed finding / issue ${issueId} not found`, 404);
    }

    // 3. Collect Relevant Repository Files Context
    const filesContext: Array<{ path: string; content: string }> = [...(input.files || [])];

    // If GitHub repo config supplied and suspectedComponent is a file path, attempt safe read
    if (input.githubRepo && this.githubService && issueRecord.rootCauseAnalysis) {
      const suspectedPath = (issueRecord.rootCauseAnalysis as any).suspectedComponent;
      if (
        suspectedPath &&
        typeof suspectedPath === 'string' &&
        suspectedPath.includes('.') &&
        !filesContext.some(f => f.path === suspectedPath)
      ) {
        try {
          const fetchedFile = await this.githubService.readFile(
            input.githubRepo.owner,
            input.githubRepo.repo,
            suspectedPath,
            undefined,
            input.githubRepo.token,
            input.githubRepo.baseUrl
          );
          if (fetchedFile && fetchedFile.content) {
            filesContext.push({
              path: fetchedFile.path,
              content: fetchedFile.content,
            });
          }
        } catch {
          // Ignore read errors and proceed with available files
        }
      }
    }

    // 4. Sanitize and Redact Secrets from all context inputs
    const safeTitle = redactString(wrapUntrustedUserPrompt(issueRecord.title));
    const safeDescription = redactString(wrapUntrustedUserPrompt(issueRecord.description || 'No description'));
    const safeActualResult = redactString(wrapUntrustedUserPrompt(issueRecord.actualResult || 'None'));

    const rca = (issueRecord.rootCauseAnalysis as any) || {};
    const safeLikelyCause = redactString(rca.likelyCause || 'Unknown root cause');
    const safeSuspectedComponent = redactString(rca.suspectedComponent || 'N/A');
    const safeRecommendedAction = redactString(rca.recommendedNextAction || 'N/A');

    const sanitizedFiles = filesContext.map(f => ({
      path: redactString(f.path),
      content: redactString(f.content),
    }));

    // 5. Construct Structured AI Prompt with Minimal Diff & No Refactor Rules
    const promptText = `You are an expert Autonomous Code Fix Engine.
Generate a targeted, minimal code fix proposal for the confirmed QA finding described below.

CRITICAL CONSTRAINTS & RULES:
- MINIMAL DIFF ONLY: Provide surgical, targeted code edits directly addressing the root cause.
- NO UNRELATED REFACTORING: Do NOT refactor untouched functions, reformat unaffected files, or clean up existing code style.
- NO DIRECT MAIN EDITS: Target task branch "${input.branchName}" is required.
- BOUNDED & STRUCTURED: Return ONLY structured JSON adhering to the response schema. Do not generate arbitrary executable scripts.

CONFIRMED FINDING:
- ID: ${issueRecord.id}
- Title: ${safeTitle}
- Category: ${issueRecord.category || 'N/A'}
- Severity: ${issueRecord.severity} (${issueRecord.severityReason || 'N/A'})
- Description: ${safeDescription}
- Actual Result: ${safeActualResult}
- Expected Result: ${issueRecord.expectedResult || 'N/A'}

ROOT-CAUSE ANALYSIS DIAGNOSIS:
- Likely Cause: ${safeLikelyCause}
- Suspected Component/File: ${safeSuspectedComponent}
- Recommended Next Action: ${safeRecommendedAction}
- Facts: ${JSON.stringify(rca.facts || [], null, 2)}

RELEVANT SOURCE CODE FILES:
${sanitizedFiles.length > 0 ? JSON.stringify(sanitizedFiles, null, 2) : 'No source files directly provided. Propose minimal fix structure.'}`;

    // 6. Invoke AI Provider
    const rawOutput = await this.aiProvider.generateStructuredQA<any>(
      {
        taskCommand: `Generate minimal code fix for finding: ${issueRecord.title}`,
        targetUrl: issueRecord.affectedUrl,
        promptOverride: promptText,
        analysisContext: {
          finding: issueRecord,
          targetFile: sanitizedFiles[0]?.path,
          targetFileContent: sanitizedFiles[0]?.content,
        },
      },
      codeFixJsonSchema
    );

    // 7. Validate Output
    const parseResult = codeFixOutputSchema.safeParse(rawOutput);
    if (!parseResult.success) {
      throw new AppError('INTERNAL_ERROR', 'AI generated invalid code fix structure', 500);
    }

    const fixOutput = parseResult.data;

    return {
      issueId: issueRecord.id,
      targetBranch: input.branchName,
      explanation: fixOutput.explanation,
      changedFiles: fixOutput.changedFiles,
      fileChanges: fixOutput.fileChanges,
      riskNotes: fixOutput.riskNotes,
    };
  }
}
