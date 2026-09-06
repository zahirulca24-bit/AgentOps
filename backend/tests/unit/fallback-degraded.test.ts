import { describe, it, expect, vi } from 'vitest';
import { GeminiProvider } from '../../src/infrastructure/ai/gemini-provider.js';
import { loadConfig } from '../../src/config/env.js';

describe('Gemini 3.6 Flash & Fallback Degraded Mode', () => {
  it('defaults AI_MODEL to gemini-3.6-flash', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
    });
    expect(config.AI_MODEL).toBe('gemini-3.6-flash');
  });

  it('handles temporary Gemini API failures gracefully for current run without permanent degradation', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'valid_looking_key_for_testing',
      AI_MODEL: 'gemini-3.6-flash',
    });

    const provider = new GeminiProvider(config);

    const mockGenerateContent = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests: Rate limit exceeded'))
      .mockResolvedValueOnce({
        text: JSON.stringify({
          objective: 'QA Verification: Recovered run',
          steps: [{ type: 'inspect', title: 'Step 1' }],
        }),
      });

    (provider as any).ai = {
      models: {
        generateContent: mockGenerateContent,
      },
    };

    // Initially available
    expect(provider.isAvailable()).toBe(true);

    // 1. Current run encounters temporary 429 error -> returns fallback response
    const currentRunResult = await provider.generateStructuredQA<any>(
      { taskCommand: 'Run 1 under temporary error' },
      { properties: { objective: { type: 'string' }, steps: { type: 'array' } } }
    );

    expect(currentRunResult.objective).toContain('QA Verification (Degraded/Fallback Mode)');
    // Provider is NOT permanently degraded for future runs
    expect(provider.isAvailable()).toBe(true);
    expect(provider.isDegraded()).toBe(false);

    // 2. Next new run retries Gemini API -> API recovers and returns live AI response
    const nextRunResult = await provider.generateStructuredQA<any>(
      { taskCommand: 'Run 2 retrying Gemini' },
      { properties: { objective: { type: 'string' }, steps: { type: 'array' } } }
    );

    expect(nextRunResult.objective).toBe('QA Verification: Recovered run');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('permanently degrades to fallback when API key is invalid', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'invalid_key',
    });

    const provider = new GeminiProvider(config);
    (provider as any).ai = {
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error('API_KEY_INVALID: Key not valid')),
      },
    };

    expect(provider.isAvailable()).toBe(true);

    await provider.generateStructuredQA<any>(
      { taskCommand: 'Test invalid key' },
      { properties: { objective: { type: 'string' }, steps: { type: 'array' } } }
    );

    // Invalid key triggers permanent fallback
    expect(provider.isAvailable()).toBe(false);
    expect(provider.isDegraded()).toBe(true);
  });

  it('marks AI-only tasks as fallback/unavailable when AI provider is degraded', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'dummy_key',
    });

    const provider = new GeminiProvider(config);

    // Test Root-Cause Analysis (AI-only task) fallback response
    const rcaOutput = await provider.generateStructuredQA<any>(
      {
        taskCommand: 'Analyze login visual defect',
        analysisContext: {
          finding: { title: 'Login Button Overflow', actualResult: 'Button misaligned' },
        },
      },
      {
        properties: {
          likelyCause: { type: 'string' },
        },
      }
    );

    expect(rcaOutput.likelyCause).toContain('[AI Unavailable]');
    expect(rcaOutput.facts[0]).toContain('[AI Provider Unavailable');

    // Test Code Fix Engine (AI-only task) fallback response
    const fixOutput = await provider.generateStructuredQA<any>(
      {
        taskCommand: 'Fix login button alignment',
        analysisContext: {
          targetFile: 'src/Login.tsx',
          targetFileContent: '<button>Submit</button>',
        },
      },
      {
        properties: {
          fileChanges: { type: 'array' },
        },
      }
    );

    expect(fixOutput.explanation).toContain('[AI Unavailable]');
    expect(fixOutput.riskNotes[0]).toContain('[AI Provider Unavailable]');
  });
});
