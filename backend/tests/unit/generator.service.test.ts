import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestGeneratorService } from '../../src/modules/generator/generator.service.js';
import type { AIProvider } from '../../src/core/ai/provider.js';

describe('TestGeneratorService', () => {
  const mockDb: any = {};

  const mockAiProvider: AIProvider = {
    generateStructuredQA: vi.fn(),
  };

  const testConfig: any = {
    MAX_TESTS_PER_RUN: 5,
    MAX_STEPS_PER_TEST: 3,
    MAX_ASSERTIONS_PER_TEST: 2,
  };

  const generatorService = new TestGeneratorService(mockDb, mockAiProvider, testConfig);

  const dummyContext = {
    runId: 'run-1',
    objective: 'Test the checkout flow',
    planSteps: [],
    explorationData: {
      observations: {
        'http://test.local/login': {
          url: 'http://test.local/login',
          title: 'Login',
          forms: [{
            inputs: [{ inputType: 'email', required: true }]
          }]
        }
      }
    }
  };

  beforeEach(() => vi.clearAllMocks());

  it('propagates the canonical target URL into AI generation and deterministic tests', async () => {
    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce({ testCases: [] });

    const tests = await generatorService.generateTests(dummyContext);

    expect(tests).toHaveLength(1);
    expect(tests[0].name).toContain('Form validation: required fields');
    expect(tests[0].steps[0]).toEqual({ action: 'navigate', target: 'http://test.local/login' });
    expect(mockAiProvider.generateStructuredQA).toHaveBeenCalledWith(
      expect.objectContaining({ targetUrl: 'http://test.local/login' }),
      expect.anything(),
    );
  });

  it('repairs missing or malformed generated navigate targets with the canonical URL', async () => {
    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce({
      testCases: [
        {
          name: 'AI Test 1',
          category: 'functional',
          priority: 'medium',
          steps: [
            { action: 'navigate', target: 'not a valid url' },
            { action: 'click', target: 'button' },
            { action: 'wait', value: '1000' },
            { action: 'scroll', value: 'down' },
          ],
          assertions: [{ type: 'element_visible', target: 'body' }]
        },
        {
          name: 'AI Test 2',
          category: 'functional',
          priority: 'medium',
          steps: [{ action: 'click', target: 'button' }],
          assertions: [{ type: 'element_visible', target: 'body' }]
        }
      ]
    });

    const tests = await generatorService.generateTests({
      ...dummyContext,
      targetUrl: 'https://example.com/app',
      explorationData: {},
    });

    expect(tests[0].steps[0]).toEqual({ action: 'navigate', target: 'https://example.com/app' });
    expect(tests[0].steps).toHaveLength(3);
    expect(tests[1].steps[0]).toEqual({ action: 'navigate', target: 'https://example.com/app' });
  });

  it('rejects destructive non-navigation actions safely', async () => {
    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce({
      testCases: [{
        name: 'Delete Account Test',
        category: 'functional',
        priority: 'high',
        steps: [{ action: 'click', target: '#delete-account-btn' }],
        assertions: [{ type: 'element_visible', target: 'body' }]
      }]
    });

    await expect(generatorService.generateTests({ ...dummyContext, targetUrl: 'https://example.com' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Generator attempted to create destructive test steps'
    });
  });

  it('rejects unsupported actions/schemas', async () => {
    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce({
      testCases: [{
        name: 'Bad Action Test',
        category: 'functional',
        priority: 'high',
        steps: [{ action: 'eval_js', target: 'alert(1)' }],
        assertions: []
      }]
    });

    await expect(generatorService.generateTests({ ...dummyContext, targetUrl: 'https://example.com' })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR'
    });
  });
});
