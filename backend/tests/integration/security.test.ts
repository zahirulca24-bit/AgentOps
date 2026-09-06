import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app/create-app.js';
import type { EnvConfig } from '../../src/config/env.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';
import path from 'path';
import { promises as fs } from 'fs';

const testConfig: EnvConfig = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3002,
  LOG_LEVEL: 'silent',
  CORS_ORIGINS: ['http://localhost:3000'],
  DATABASE_URL: 'postgresql://user:pass@test-host:5432/testdb',
  AI_MODEL: 'gemini-3.6-flash',
  MAX_CONCURRENT_SESSIONS: 2,
  BROWSER_ACTION_TIMEOUT_MS: 3000,
  BROWSER_NAVIGATION_TIMEOUT_MS: 5000,
  MAX_EXPLORATION_PAGES: 3,
  MAX_EXPLORATION_DEPTH: 2,
  MAX_TESTS_PER_RUN: 5,
  MAX_STEPS_PER_TEST: 10,
  MAX_ASSERTIONS_PER_TEST: 5,
  MAX_RUN_TIMEOUT_MS: 300000,
  MAX_TEST_TIMEOUT_MS: 30000,
  RATE_LIMIT_READ_MAX: 100,
  RATE_LIMIT_HEAVY_MAX: 20,
  RATE_LIMIT_WINDOW_MS: 60000,
  EVIDENCE_STORAGE_DIR: './test-evidence',
  MAX_EVIDENCE_SIZE_MB: 1,
  MAX_SSE_SUBSCRIBERS: 2,
};

describe('B12 Security Integration', () => {
  let app: FastifyInstance;
  let evidenceService: EvidenceService;

  beforeAll(async () => {
    app = await createApp(testConfig);
    evidenceService = new EvidenceService(testConfig);
    await evidenceService.initialize();
  });

  afterAll(async () => {
    await app.close();
    try {
      await fs.rm(path.resolve('./test-evidence'), { recursive: true, force: true });
    } catch {}
  });

  describe('Security Headers', () => {
    it('sets security headers via helmet on responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Evidence Service & Endpoints', () => {
    it('stores evidence safely and redacts sensitive data', async () => {
      const metadata = await evidenceService.storeEvidence({
        filename: 'log.txt',
        contentType: 'text/plain',
        content: 'Server secret API_KEY: secret12345',
      });

      expect(metadata.id).toBeDefined();

      const retrieved = await evidenceService.getEvidence(metadata.id);
      const text = retrieved.content.toString('utf-8');
      expect(text).not.toContain('secret12345');
      expect(text).toContain('[REDACTED]');
    });

    it('retrieves evidence file via HTTP route', async () => {
      const metadata = await evidenceService.storeEvidence({
        filename: 'screenshot.png',
        contentType: 'image/png',
        content: Buffer.from('fake-image-data'),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/evidence/${metadata.id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
    });

    it('rejects invalid evidence ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/evidence/invalid-id',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('enforces maximum file size limit', async () => {
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024); // 2MB > 1MB limit in testConfig
      await expect(
        evidenceService.storeEvidence({
          filename: 'big.dat',
          content: largeBuffer,
        })
      ).rejects.toMatchObject({
        code: 'PAYLOAD_TOO_LARGE',
      });
    });
  });
});
