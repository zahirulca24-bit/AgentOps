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

  it('handles generic Gemini API failures gracefully without throwing AppError', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'valid_looking_key_for_testing',
      AI_MODEL: 'gemini-3.6-flash',
    });

    const provider = new GeminiProvider(config);

    // Mock internal AI model generateContent to simulate a rate-limit 429 / 500 network failure
    (provider as any).ai = {
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error('429 Too Many Requests: Rate limit exceeded')),
      },
    };

    // Initially available
    expect(provider.isAvailable()).toBe(true);
    expect(provider.isDegraded()).toBe(false);

    // Generate plan while Gemini API is failing
    const result = await provider.generateStructuredQA<any>(
      {
        taskCommand: 'Test generic API failure fallback',
        targetUrl: 'https://example.com',
      },
      {
        properties: {
          objective: { type: 'string' },
          steps: { type: 'array' },
        },
      }
    );

    // QA run does NOT fail; fallback plan is returned
    expect(result).toBeDefined();
    expect(result.objective).toContain('QA Verification (Degraded/Fallback Mode)');
    expect(result.steps).toBeDefined();

    // Provider state is set to degraded mode
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
