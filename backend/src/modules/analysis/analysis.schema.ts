import { z } from 'zod';

export const confidenceEnum = z.enum(['high', 'medium', 'low']);

export const rootCauseAnalysisSchema = z.object({
  likelyCause: z.string().min(1),
  confidence: confidenceEnum,
  affectedArea: z.string().min(1),
  suspectedComponent: z.string().nullable().optional(),
  recommendedNextAction: z.string().min(1),
  facts: z.array(z.string()).min(1),
  inference: z.string().min(1),
});

export type RootCauseAnalysisOutput = z.infer<typeof rootCauseAnalysisSchema>;

export const rootCauseAnalysisJsonSchema = {
  type: 'object',
  properties: {
    likelyCause: { type: 'string', description: 'Primary root cause hypothesis' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence rating' },
    affectedArea: { type: 'string', description: 'Subsystem or layer affected' },
    suspectedComponent: { type: 'string', nullable: true, description: 'Suspected file, UI component, or API endpoint name' },
    recommendedNextAction: { type: 'string', description: 'Actionable remediation step for engineers' },
    facts: {
      type: 'array',
      items: { type: 'string' },
      description: 'Empirical observed evidence and facts (e.g. console errors, 402 responses, assertion failures)'
    },
    inference: { type: 'string', description: 'AI diagnostic deduction explaining why the cause produced the failure' }
  },
  required: ['likelyCause', 'confidence', 'affectedArea', 'recommendedNextAction', 'facts', 'inference']
};
