import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app/create-app.js';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../src/core/errors.js';

const testConfig = {
  NODE_ENV: 'test' as const,
  HOST: '127.0.0.1',
  PORT: 3001,
  LOG_LEVEL: 'silent' as const,
  CORS_ORIGINS: ['http://localhost:3000']
};

describe('Error Handling and Architecture', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(testConfig);
    
    // Setup temporary test routes to trigger errors
    app.get('/test-app-error', async () => {
      throw new AppError('VALIDATION_ERROR', 'A test validation error', 400);
    });

    app.get('/test-500', async () => {
      throw new Error('Unexpected catastrophic failure');
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('handles 404 with proper error envelope and request ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-route',
      headers: {
        'x-request-id': 'test-req-id-1'
      }
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Route not found');
    expect(body.error.requestId).toBe('test-req-id-1');
  });

  it('handles AppError properly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-app-error',
      headers: {
        'x-request-id': 'test-req-id-2'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('A test validation error');
    expect(body.error.requestId).toBe('test-req-id-2');
  });

  it('handles generic Error by returning safe 500 without stack trace', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-500',
      headers: {
        'x-request-id': 'test-req-id-3'
      }
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    expect(body.error.requestId).toBe('test-req-id-3');
    // Ensure stack trace is not exposed
    expect(body.error.stack).toBeUndefined();
    expect(response.payload).not.toContain('Unexpected catastrophic failure');
  });

  it('generates a request ID if none is provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });
    
    // The health route returns 200, so we check headers for the generated ID
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('applies CORS properly for allowed origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
      }
    });

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('applies CORS properly for disallowed origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://evil.com',
        'access-control-request-method': 'GET',
      }
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
