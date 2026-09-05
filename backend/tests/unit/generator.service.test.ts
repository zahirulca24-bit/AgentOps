import { describe, it, expect, vi } from 'vitest';
import { TestGeneratorService } from '../../src/modules/generator/generator.service.js';
import type { AIProvider } from '../../src/core/ai/provider.js';
import { AppError } from '../../src/core/errors.js';

describe('TestGeneratorService', () => {
  const mockDb: any = {
    transaction: vi.fn(async (cb) => {
      const txMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([])
        })
      };
      return cb(txMock);
    }),
  };

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

  it('deterministically generates form validation tests and persists them', async () => {
    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce({ testCases: [] });
    
    const tests = await generatorService.generateTests(dummyContext);
    
    expect(tests.length).toBe(1);
    expect(tests[0].name).toContain('Form validation: required fields');
    expect(tests[0].category).toBe('form');
    expect(tests[0].steps).toHaveLength(2); // navigate + click submit
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('incorporates AI-generated tests and enforces limits', async () => {
    const aiTests = [
      {
        name: 'AI Test 1',
        category: 'functional',
        priority: 'medium',
        steps: [
          { action: 'navigate', target: 'http://test.local' },
          { action: 'click', target: 'button' },
          { action: 'wait', value: '1000' },
          { action: 'scroll', value: 'down' } // 4 steps, limit is 3
        ],
        assertions: [
          { type: 'element_visible' }
        ]
      }
    ];

    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce({ testCases: aiTests });
    
    const tests = await generatorService.generateTests({
      ...dummyContext,
      explorationData: {} // Skip deterministic form for this test
    });
    
    expect(tests.length).toBe(1);
    expect(tests[0].name).toBe('AI Test 1');
    expect(tests[0].steps.length).toBe(3); // Truncated to MAX_STEPS_PER_TEST
  });

  it('rejects destructive actions safely', async () => {
    const aiTests = [
      {
        name: 'Delete Account Test',
        category: 'functional',
        priority: 'high',
        steps: [
          { action: 'click', target: '#delete-account-btn' } // 'delete' in target
        ],
        assertions: [
          { type: 'element_visible' }
        ]
      }
    ];

    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce({ testCases: aiTests });
    
    await expect(generatorService.generateTests(dummyContext)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Generator attempted to create destructive test steps'
    });
  });

  it('rejects unsupported actions/schemas (Zod validation)', async () => {
    const invalidAiTests = [
      {
        name: 'Bad Action Test',
        category: 'functional',
        priority: 'high',
        steps: [
          { action: 'eval_js', target: 'alert(1)' } // invalid action
        ],
        assertions: []
      }
    ];

    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce({ testCases: invalidAiTests });
    
    await expect(generatorService.generateTests(dummyContext)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR'
    });
  });
});
