import { z } from 'zod';

export const fileChangeSchema = z.object({
  path: z.string().min(1, 'Target file path is required'),
  originalContent: z.string().optional(),
  newContent: z.string().min(1, 'New content is required'),
  diff: z.string().optional(),
});

export const codeFixOutputSchema = z.object({
  explanation: z.string().min(1, 'Fix explanation is required'),
  changedFiles: z.array(z.string()).min(1, 'At least one changed file is required'),
  fileChanges: z.array(fileChangeSchema).min(1, 'At least one file change proposal is required'),
  riskNotes: z.array(z.string()).default([]),
});

export const codeFixInputSchema = z.object({
  branchName: z.string().min(1, 'Task branch name is required'),
  files: z.array(
    z.object({
      path: z.string().min(1, 'File path is required'),
      content: z.string(),
    })
  ).optional().default([]),
  githubRepo: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    token: z.string().min(1),
    baseUrl: z.string().url().optional(),
  }).optional(),
});

export type FileChange = z.infer<typeof fileChangeSchema>;
export type CodeFixOutput = z.infer<typeof codeFixOutputSchema>;
export type CodeFixInput = z.infer<typeof codeFixInputSchema>;

export const codeFixJsonSchema = {
  type: 'object',
  properties: {
    explanation: {
      type: 'string',
      description: 'Short, clear explanation of the proposed minimal code fix',
    },
    changedFiles: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of target file paths being modified',
    },
    fileChanges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          originalContent: { type: 'string' },
          newContent: { type: 'string' },
          diff: { type: 'string' },
        },
        required: ['path', 'newContent'],
      },
      description: 'Minimal targeted file content modifications',
    },
    riskNotes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Notes on potential side effects, risks, or manual regression testing steps',
    },
  },
  required: ['explanation', 'changedFiles', 'fileChanges', 'riskNotes'],
};
