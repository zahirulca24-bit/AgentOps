import { GoogleGenAI } from '@google/genai';
import type { AIProvider, StructuredQAContext } from '../../core/ai/provider.js';
import type { EnvConfig } from '../../config/env.js';
import { AppError } from '../../core/errors.js';

export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  private model: string;
  private isDummyKey: boolean;

  constructor(config: EnvConfig) {
    this.isDummyKey = !config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'dummy_key';
    if (this.isDummyKey) {
      console.warn('[AI] GEMINI_API_KEY is not set or set to dummy key. Using local deterministic fallback provider.');
    }
    
    this.ai = new GoogleGenAI({
      apiKey: config.GEMINI_API_KEY || 'dummy_key',
    });
    this.model = config.AI_MODEL;
  }

  async generateStructuredQA<T>(context: StructuredQAContext, responseSchema: any): Promise<T> {
    if (this.isDummyKey) {
      return this.getFallbackResponse<T>(context, responseSchema);
    }

    const prompt = `You are an expert QA Planner.
Task Command: ${context.taskCommand}
Target URL: ${context.targetUrl || 'Not specified'}

Analyze the command and create a safe, high-level QA plan.
Do not generate arbitrary executable code. Do not hallucinate URLs.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.1,
        },
      });

      if (!response.text) {
        throw new Error('Empty response from AI model');
      }
      
      return JSON.parse(response.text) as T;
    } catch (error: any) {
      const errMsg = String(error?.message || error);
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('INVALID_ARGUMENT')) {
        console.warn('[AI] Gemini API Key invalid. Falling back to local deterministic provider.');
        return this.getFallbackResponse<T>(context, responseSchema);
      }
      throw new AppError('INTERNAL_ERROR', `AI Provider failure: ${errMsg}`, 500);
    }
  }

  private getFallbackResponse<T>(context: StructuredQAContext, responseSchema: any): T {
    const schemaProperties = responseSchema?.properties || {};

    if (schemaProperties.objective && schemaProperties.steps) {
      // Planner Response Schema
      return {
        objective: `QA Verification: ${context.taskCommand.slice(0, 100)}`,
        steps: [
          {
            type: 'inspect',
            title: 'Load target URL and verify page structure',
            description: `Navigate to ${context.targetUrl || 'target site'} and inspect document structure`
          },
          {
            type: 'test',
            title: 'Validate page interaction and content visibility',
            description: 'Check main heading elements, buttons, and forms'
          },
          {
            type: 'capture_evidence',
            title: 'Perform layout and assertion checks',
            description: 'Run visual QA overflow checks and element visibility assertions'
          }
        ]
      } as unknown as T;
    }

    if (schemaProperties.testCases) {
      // Test Generator Response Schema
      const targetUrl = context.targetUrl || 'https://example.com';
      return {
        testCases: [
          {
            name: `Verify page load & title for ${context.taskCommand.slice(0, 50)}`,
            category: 'functional',
            priority: 'high',
            preconditions: 'Target URL is accessible',
            steps: [
              { action: 'navigate', target: targetUrl },
              { action: 'wait', value: '1000' }
            ],
            assertions: [
              { type: 'element_visible', target: 'body' }
            ]
          }
        ]
      } as unknown as T;
    }

    throw new AppError('INTERNAL_ERROR', 'Unknown AI schema fallback request', 500);
  }
}
