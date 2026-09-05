import { z } from 'zod';

export const navigateSchema = z.object({
  url: z.string().url(),
});

export const clickSchema = z.object({
  selector: z.string().min(1).max(1000),
});

export const fillSchema = z.object({
  selector: z.string().min(1).max(1000),
  value: z.string().max(5000),
});

export const selectSchema = z.object({
  selector: z.string().min(1).max(1000),
  value: z.string().max(1000),
});

export const scrollSchema = z.object({
  direction: z.enum(['up', 'down', 'top', 'bottom']).optional(),
  pixels: z.number().int().min(-10000).max(10000).optional(),
}).refine(data => data.direction || data.pixels, {
  message: 'Must provide either direction or pixels',
});

export const waitSchema = z.object({
  timeoutMs: z.number().int().positive().max(30000),
});

export const readSchema = z.object({});

export const screenshotSchema = z.object({
  fullPage: z.boolean().default(false),
});

export type NavigateAction = z.infer<typeof navigateSchema>;
export type ClickAction = z.infer<typeof clickSchema>;
export type FillAction = z.infer<typeof fillSchema>;
export type SelectAction = z.infer<typeof selectSchema>;
export type ScrollAction = z.infer<typeof scrollSchema>;
export type WaitAction = z.infer<typeof waitSchema>;
export type ReadAction = z.infer<typeof readSchema>;
export type ScreenshotAction = z.infer<typeof screenshotSchema>;
