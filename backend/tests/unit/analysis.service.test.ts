import { describe, it, expect, beforeEach } from 'vitest';
import { RootCauseAnalysisService } from '../../src/modules/analysis/analysis.service.js';
import { createInMemoryDb } from '../../src/infrastructure/db/in-memory-db.js';
import type { AIProvider, StructuredQAContext } from '../../src/core/ai/provider.js';
import { issues, runs, testResults } from '../../src/infrastructure/db/schema.js';
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
      likelyCause: 'Mocked AI Diagnosis: Sticky element occlusion on checkout CTA',
      confidence: 'high',
      affectedArea: 'Frontend UI / Element Occlusion',
      suspectedComponent: 'src/components/CheckoutButton.tsx',
      recommendedNextAction: 'Adjust z-index of CTA container or handle cookie banner dismiss prior to click.',
      facts: [
        'Finding Title: Checkout button unclickable',
        'Error Message: Click intercepted by #cookie-banner overlay',
        'Console Errors: Unhandled pointer intercept event'
      ],
      inference: 'The cookie banner overlay sits at a higher z-index (z-50) than the checkout button, preventing click dispatch.'
    } as unknown as T;
  }
}

describe('RootCauseAnalysisService - Unit Tests with Mocked AI', () => {
  let db: any;
  let mockAI: MockAIProvider;
  let service: RootCauseAnalysisService;
  let testRunId: string;
  let testIssueId: string;
  let testResultId: string;

  beforeEach(async () => {
    db = createInMemoryDb();
    mockAI = new MockAIProvider();
    service = new RootCauseAnalysisService(db, mockAI);

    testRunId = crypto.randomUUID();
    testResultId = crypto.randomUUID();
    testIssueId = crypto.randomUUID();

    // Seed mock DB data
    await db.insert(runs).values({
      id: testRunId,
      taskId: crypto.randomUUID(),
      status: 'failed',
    });

    await db.insert(testResults).values({
      id: testResultId,
      runId: testRunId,
      name: 'Checkout CTA Click Test',
      status: 'failed',
      errorMessage: 'Assertion failed: #checkout-btn is clickable',
      summary: 'Click intercepted by overlay',
      durationMs: 450,
    });

    await db.insert(issues).values({
      id: testIssueId,
      runId: testRunId,
      testResultId,
      title: 'Checkout button unclickable on mobile view',
      description: 'The CTA button is occluded by sticky cookie banner',
      severity: 'high',
      severityReason: 'User flow is blocked for affected users.',
      category: 'functional',
      status: 'open',
      reproductionSteps: ['Navigate to cart', 'Set viewport 375px', 'Click #checkout-btn'],
      expectedResult: 'Checkout modal opens',
      actualResult: 'Click intercepted by #cookie-banner overlay',
      affectedUrl: 'https://example.com/cart',
    });
  });

  it('aggregates failure context and generates structured AI root-cause analysis', async () => {
    const analysis = await service.analyzeIssue(testIssueId);

    expect(analysis).toBeDefined();
    expect(analysis.likelyCause.toLowerCase()).toContain('checkout cta');
    expect(analysis.confidence).toBe('high');
    expect(analysis.affectedArea).toBe('Frontend UI / Element Occlusion');
    expect(analysis.suspectedComponent).toBe('src/components/CheckoutButton.tsx');
    expect(analysis.recommendedNextAction).toBeDefined();
    expect(Array.isArray(analysis.facts)).toBe(true);
    expect(analysis.facts.length).toBeGreaterThan(0);
    expect(analysis.inference).toBeDefined();
    expect(analysis.inference.length).toBeGreaterThan(10);
  });

  it('clearly separates empirical facts from AI inference in response', async () => {
    mockAI.mockResponse = {
      likelyCause: 'HTTP 402 Payment Required from payment gateway API',
      confidence: 'high',
      affectedArea: 'Payment Gateway Integration',
      suspectedComponent: 'POST /api/v1/checkout/charge',
      recommendedNextAction: 'Update test card details or bypass 3D Secure modal in test mode.',
      facts: [
        'Console log: POST https://api.stripe.com/v1/charges returned 402',
        'Test error message: Payment card declined by test gateway'
      ],
      inference: 'The simulated test card triggered an automated anti-fraud security hold on the payment processor endpoint.'
    };

    const analysis = await service.analyzeIssue(testIssueId);

    expect(analysis.facts).toEqual([
      'Console log: POST https://api.stripe.com/v1/charges returned 402',
      'Test error message: Payment card declined by test gateway'
    ]);

    expect(analysis.inference).toBe('The simulated test card triggered an automated anti-fraud security hold on the payment processor endpoint.');
  });

  it('persists analysis result to issues table in database', async () => {
    await service.analyzeIssue(testIssueId);

    const issueInDb = await db.query.issues.findFirst({
      where: (t: any) => t.id === testIssueId,
    });

    expect(issueInDb.rootCauseAnalysis).toBeDefined();
    expect(issueInDb.rootCauseAnalysis.confidence).toBe('high');
    expect(issueInDb.rootCauseAnalysis.likelyCause.toLowerCase()).toContain('checkout cta');
  });

  it('throws 404 AppError if issue is not found', async () => {
    await expect(service.analyzeIssue(crypto.randomUUID())).rejects.toThrow('not found');
  });
});
