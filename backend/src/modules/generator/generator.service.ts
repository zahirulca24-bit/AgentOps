import type { Database } from '../../infrastructure/db/client.js';
import type { EnvConfig } from '../../config/env.js';
import type { AIProvider } from '../../core/ai/provider.js';
import { testCases } from '../../infrastructure/db/schema.js';
import { AppError } from '../../core/errors.js';
import {
  normalizeAbsoluteTargetUrl,
  resolveNavigationUrl,
} from '../execution/target-url.js';
import { 
  testGenerationOutputSchema, 
  testGenerationJsonSchema, 
  type TestCase 
} from './generator.schema.js';

export interface GenerationContext {
  runId: string;
  objective: string;
  targetUrl: string;
  planSteps: Array<{ title: string; description?: string | null }>;
  explorationData: any; // WebsiteMap from B8
}

export class TestGeneratorService {
  constructor(
    private db: Database, 
    private aiProvider: AIProvider,
    private config: EnvConfig
  ) {}

  public async generateTests(context: GenerationContext): Promise<TestCase[]> {
    const targetUrl = normalizeAbsoluteTargetUrl(context.targetUrl);
    const promptContext = {
      taskCommand: context.objective,
      targetUrl,
      additionalContext: JSON.stringify({
        targetUrl,
        plan: context.planSteps,
        flows: context.explorationData.flowCandidates || [],
        pages: Object.values(context.explorationData.observations || {}).map((o: any) => ({
          url: o.url,
          forms: o.forms?.length,
          links: o.links?.length
        }))
      }).slice(0, 15000) // bounded context size
    };

    const rawOutput = await this.aiProvider.generateStructuredQA<any>(
      promptContext,
      testGenerationJsonSchema
    );

    const parseResult = testGenerationOutputSchema.safeParse(rawOutput);
    if (!parseResult.success) {
      throw new AppError('INTERNAL_ERROR', 'AI generated invalid test cases structure', 500);
    }

    // Deterministic generation: Required field validations
    const deterministicTests: TestCase[] = [];
    if (context.explorationData.observations) {
      for (const obs of Object.values(context.explorationData.observations) as any[]) {
        for (const form of obs.forms || []) {
          const requiredInputs = form.inputs?.filter((i: any) => i.required) || [];
          if (requiredInputs.length > 0) {
            deterministicTests.push({
              name: `Form validation: required fields on ${obs.title || obs.url}`,
              category: 'form',
              priority: 'high',
              preconditions: `Navigate to ${obs.url}`,
              steps: [
                { action: 'navigate', target: resolveNavigationUrl(obs.url, targetUrl) },
                // click submit without filling
                { action: 'click', target: 'button[type="submit"]' }
              ],
              assertions: [
                { type: 'validation_message_present' }
              ]
            });
          }
        }
      }
    }

    let generatedTests = [...deterministicTests, ...parseResult.data.testCases];

    // Enforce limits, canonical URL propagation, and safety boundaries.
    generatedTests = generatedTests.slice(0, this.config.MAX_TESTS_PER_RUN);
    
    for (const test of generatedTests) {
      const normalizedSteps = test.steps.map((step) =>
        step.action === 'navigate'
          ? { ...step, target: resolveNavigationUrl(step.target, targetUrl) }
          : step
      );

      if (!normalizedSteps.some((step) => step.action === 'navigate')) {
        normalizedSteps.unshift({ action: 'navigate', target: targetUrl });
      }

      test.steps = normalizedSteps.slice(0, this.config.MAX_STEPS_PER_TEST);

      if (test.assertions.length > this.config.MAX_ASSERTIONS_PER_TEST) {
        test.assertions = test.assertions.slice(0, this.config.MAX_ASSERTIONS_PER_TEST);
      }
      
      // Enforce No Destructive Actions safely
      const dangerousTerms = ['delete', 'remove', 'checkout', 'pay', 'transfer'];
      const hasDangerousTarget = test.steps.some(s => 
        s.target && dangerousTerms.some(term => s.target!.toLowerCase().includes(term))
      );
      if (hasDangerousTarget) {
        throw new AppError('VALIDATION_ERROR', 'Generator attempted to create destructive test steps', 400);
      }
    }

    if (generatedTests.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'No valid tests generated', 400);
    }

    // Persist once. The API orchestration layer must not insert these again.
    await this.db.transaction(async (tx: any) => {
      const inserts = generatedTests.map(t => ({
        runId: context.runId,
        name: t.name,
        category: t.category,
        priority: t.priority,
        preconditions: t.preconditions,
        steps: t.steps,
        assertions: t.assertions,
      }));
      await tx.insert(testCases).values(inserts);
    });

    return generatedTests;
  }
}
