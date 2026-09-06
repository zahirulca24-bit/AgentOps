import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:3000').transform((val) => val.split(',').map(s => s.trim())),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/agentops'),
  GEMINI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gemini-3.6-flash'),
  MAX_CONCURRENT_SESSIONS: z.coerce.number().int().positive().default(5),
  BROWSER_ACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  BROWSER_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  MAX_EXPLORATION_PAGES: z.coerce.number().int().positive().default(5),
  MAX_EXPLORATION_DEPTH: z.coerce.number().int().positive().default(2),
  MAX_TESTS_PER_RUN: z.coerce.number().int().positive().default(20),
  MAX_STEPS_PER_TEST: z.coerce.number().int().positive().default(10),
  MAX_ASSERTIONS_PER_TEST: z.coerce.number().int().positive().default(5),
  MAX_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  MAX_TEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  RATE_LIMIT_READ_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_HEAVY_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  EVIDENCE_STORAGE_DIR: z.string().default('./evidence'),
  MAX_EVIDENCE_SIZE_MB: z.coerce.number().int().positive().default(10),
  MAX_SSE_SUBSCRIBERS: z.coerce.number().int().positive().default(10),
});






export type EnvConfig = z.infer<typeof envSchema>;

export function loadConfig(env = process.env): EnvConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error('Invalid environment configuration:', result.error.format());
    process.exit(1);
  }
  return result.data;
}
