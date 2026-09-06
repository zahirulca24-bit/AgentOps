import { describe, it, expect, beforeEach } from 'vitest';
import { CodeFixService } from '../../src/modules/fix/fix.service.js';
import { createInMemoryDb } from '../../src/infrastructure/db/in-memory-db.js';
import type { AIProvider, StructuredQAContext } from '../../src/core/ai/provider.js';
import { MockGitHubProvider } from '../../src/infrastructure/github/mock-github-provider.js';
import { issues, runs } from '../../src/infrastructure/db/schema.js';
import crypto from 'crypto';

class MockAIProvider implements AIProvider {
  public lastContext: StructuredQAContext | null = null;
  public mockResponse: any = null;

  async generateStructuredQA<T>(context: StructuredQAContext, _responseSchema: any): Promise<T> {
    this.lastContext = context;
    if (this.mockResponse) {
      return this.mockResponse as T;
    }
    return {
      explanation: 'Minimal targeted fix: Increase z-index of checkout CTA button to overlay sticky cookie banner.',
      changedFiles: ['src/components/CheckoutButton.tsx'],
      fileChanges: [
        {
          path: 'src/components/CheckoutButton.tsx',
          originalContent: 'export const CheckoutButton = () => <button className="relative z-10">Checkout</button>;',
          newContent: 'export const CheckoutButton = () => <button className="relative z-50">Checkout</button>;',
          diff: '--- src/components/CheckoutButton.tsx\n+++ src/components/CheckoutButton.tsx\n@@ -1 +1 @@\n-export const CheckoutButton = () => <button className="relative z-10">Checkout</button>;\n+export const CheckoutButton = () => <button className="relative z-50">Checkout</button>;',
        }
      ],
      riskNotes: [
        'Verify mobile viewport rendering at 375px width.',
        'Ensure cookie banner dismiss flow operates independently.'
      ]
    } as unknown as T;
  }
}

describe('CodeFixService - Unit Tests', () => {
  let db: any;
  let mockAI: MockAIProvider;
  let mockGitHub: MockGitHubProvider;
  let service: CodeFixService;
  let testIssueId: string;

  beforeEach(async () => {
    db = createInMemoryDb();
    mockAI = new MockAIProvider();
    mockGitHub = new MockGitHubProvider();
    service = new CodeFixService(db, mockAI, mockGitHub);

    const testRunId = crypto.randomUUID();
    testIssueId = crypto.randomUUID();

    await db.insert(runs).values({
      id: testRunId,
      taskId: crypto.randomUUID(),
      status: 'failed',
    });

    await db.insert(issues).values({
      id: testIssueId,
      runId: testRunId,
      title: 'Checkout button unclickable on mobile view',
      description: 'CTA button intercepted by cookie banner with token ghp_SECRET_TOKEN_999999',
      severity: 'high',
      severityReason: 'User flow blocked',
      category: 'functional',
      status: 'open',
      expectedResult: 'Checkout modal opens',
      actualResult: 'Click intercepted by #cookie-banner overlay',
      affectedUrl: 'https://example.com/cart',
      rootCauseAnalysis: {
        likelyCause: 'Element occlusion by cookie banner',
        confidence: 'high',
        affectedArea: 'Frontend UI / Element Occlusion',
        suspectedComponent: 'src/components/CheckoutButton.tsx',
        recommendedNextAction: 'Increase z-index or handle banner dismiss',
        facts: ['Finding Title: Checkout button unclickable'],
        inference: 'Cookie banner z-index is higher than checkout CTA',
      }
    });
  });

  describe('Task Branch Policy Enforcement', () => {
    it('allows valid task branch names (e.g. agentops/task-101)', () => {
      expect(() => service.validateTaskBranchPolicy('agentops/task-101')).not.toThrow();
      expect(() => service.validateTaskBranchPolicy('fix/occlusion-bug')).not.toThrow();
    });

    it('blocks direct edits to main, master, production, release branches with 403 FORBIDDEN', () => {
      expect(() => service.validateTaskBranchPolicy('main')).toThrow('strictly blocked');
      expect(() => service.validateTaskBranchPolicy('master')).toThrow('strictly blocked');
      expect(() => service.validateTaskBranchPolicy('production')).toThrow('strictly blocked');
    });

    it('throws validation error for empty or missing branch name', () => {
      expect(() => service.validateTaskBranchPolicy('')).toThrow('branch name is required');
    });
  });

  describe('Fix Proposal Generation', () => {
    it('generates minimal code fix proposal for an existing issue on task branch', async () => {
      const proposal = await service.generateFixProposal(testIssueId, {
        branchName: 'agentops/task-201',
        files: [
          {
            path: 'src/components/CheckoutButton.tsx',
            content: 'export const CheckoutButton = () => <button className="relative z-10">Checkout</button>;'
          }
        ]
      });

      expect(proposal).toBeDefined();
      expect(proposal.issueId).toBe(testIssueId);
      expect(proposal.targetBranch).toBe('agentops/task-201');
      expect(proposal.explanation).toContain('z-index');
      expect(proposal.changedFiles).toContain('src/components/CheckoutButton.tsx');
      expect(proposal.fileChanges.length).toBe(1);
      expect(proposal.riskNotes.length).toBeGreaterThan(0);
    });

    it('blocks proposal generation if task branch is main', async () => {
      await expect(
        service.generateFixProposal(testIssueId, { branchName: 'main' })
      ).rejects.toThrow('strictly blocked');
    });

    it('throws 404 AppError if issue is not found', async () => {
      await expect(
        service.generateFixProposal(crypto.randomUUID(), { branchName: 'agentops/task-202' })
      ).rejects.toThrow('not found');
    });

    it('redacts secrets and sensitive tokens from AI prompt context', async () => {
      await service.generateFixProposal(testIssueId, {
        branchName: 'agentops/task-203',
        files: [{ path: 'config.ts', content: 'const key = "ghp_1234567890abcdef1234567890abcdef123456";' }]
      });

      const promptText = mockAI.lastContext?.promptOverride || '';
      expect(promptText).not.toContain('ghp_1234567890');
      expect(promptText).not.toContain('SECRET_TOKEN_999999');
    });
  });
});
