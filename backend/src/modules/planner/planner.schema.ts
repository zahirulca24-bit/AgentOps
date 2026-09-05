import { z } from 'zod';
import { Type } from '@google/genai'; // Using to define JSON schema for GenAI

export const plannerStepTypes = [
  'inspect',
  'explore',
  'test',
  'observe_console',
  'observe_network',
  'capture_evidence'
] as const;

export const plannerStepSchema = z.object({
  type: z.enum(plannerStepTypes),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const plannerOutputSchema = z.object({
  objective: z.string().max(500),
  steps: z.array(plannerStepSchema).min(1).max(20),
});

export type PlannerOutput = z.infer<typeof plannerOutputSchema>;

// Corresponding JSON Schema for the GenAI provider
export const plannerJsonSchema = {
  type: Type.OBJECT,
  properties: {
    objective: {
      type: Type.STRING,
      description: 'The overall objective of the QA plan.',
    },
    steps: {
      type: Type.ARRAY,
      description: 'The steps to execute the plan.',
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: plannerStepTypes,
          },
          title: {
            type: Type.STRING,
            description: 'A short, descriptive title for the step.',
          },
          description: {
            type: Type.STRING,
            description: 'Optional details on what needs to be done.',
          },
        },
        required: ['type', 'title'],
      },
    },
  },
  required: ['objective', 'steps'],
};
