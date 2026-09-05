import { z } from 'zod';
import { Type } from '@google/genai';

export const testActionTypes = [
  'navigate',
  'click',
  'fill',
  'select',
  'scroll',
  'wait',
] as const;

export const testAssertionTypes = [
  'url_matches',
  'element_visible',
  'text_present',
  'element_enabled',
  'validation_message_present',
  'no_console_error',
  'no_failed_request',
  'visual_check',
] as const;

export const testCategoryTypes = [
  'functional',
  'navigation',
  'form',
  'visual',
  'console',
  'network',
] as const;

export const testStepSchema = z.object({
  action: z.enum(testActionTypes),
  target: z.string().optional(), // Selector or URL
  value: z.string().optional(),  // Value to fill or option to select
});

export const testAssertionSchema = z.object({
  type: z.enum(testAssertionTypes),
  target: z.string().optional(), // Selector
  expected: z.string().optional(),
});

export const testCaseSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(testCategoryTypes),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  preconditions: z.string().max(1000).optional(),
  steps: z.array(testStepSchema).min(1).max(10), // Will map env limit dynamically in service
  assertions: z.array(testAssertionSchema).min(1).max(5),
});

export const testGenerationOutputSchema = z.object({
  testCases: z.array(testCaseSchema),
});

export type TestStep = z.infer<typeof testStepSchema>;
export type TestAssertion = z.infer<typeof testAssertionSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type TestGenerationOutput = z.infer<typeof testGenerationOutputSchema>;

// Gemini JSON schema for provider
export const testGenerationJsonSchema = {
  type: Type.OBJECT,
  properties: {
    testCases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { type: Type.STRING, enum: [...testCategoryTypes] },
          priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
          preconditions: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING, enum: [...testActionTypes] },
                target: { type: Type.STRING },
                value: { type: Type.STRING },
              },
              required: ['action']
            }
          },
          assertions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: [...testAssertionTypes] },
                target: { type: Type.STRING },
                expected: { type: Type.STRING },
              },
              required: ['type']
            }
          }
        },
        required: ['name', 'category', 'priority', 'steps', 'assertions']
      }
    }
  },
  required: ['testCases']
};
