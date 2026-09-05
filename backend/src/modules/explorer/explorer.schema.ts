import { z } from 'zod';

export const interactiveElementSchema = z.object({
  tag: z.string(),
  role: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  testId: z.string().optional(),
  href: z.string().optional(),
  inputType: z.string().optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

export const formSchema = z.object({
  id: z.string().optional(),
  action: z.string().optional(),
  method: z.string().optional(),
  inputs: z.array(interactiveElementSchema),
  buttons: z.array(interactiveElementSchema),
});

export const pageObservationSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  headings: z.array(z.string()).max(50), // bounded
  links: z.array(interactiveElementSchema).max(100),
  buttons: z.array(interactiveElementSchema).max(50),
  forms: z.array(formSchema).max(10),
});

export const flowCandidateSchema = z.object({
  type: z.enum(['login', 'signup', 'search', 'contact', 'navigation', 'crud', 'unknown']),
  confidence: z.number().min(0).max(1),
  elements: z.array(interactiveElementSchema),
});

export const websiteMapSchema = z.object({
  startUrl: z.string().url(),
  pagesObserved: z.number().int().nonnegative(),
  observations: z.record(z.string().url(), pageObservationSchema),
  flowCandidates: z.array(flowCandidateSchema),
});

export type InteractiveElement = z.infer<typeof interactiveElementSchema>;
export type FormObservation = z.infer<typeof formSchema>;
export type PageObservation = z.infer<typeof pageObservationSchema>;
export type FlowCandidate = z.infer<typeof flowCandidateSchema>;
export type WebsiteMap = z.infer<typeof websiteMapSchema>;
