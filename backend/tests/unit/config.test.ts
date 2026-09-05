import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

describe('Configuration Validation', () => {
  it('parses valid environment configuration', () => {
    const mockEnv = {
      NODE_ENV: 'test',
      HOST: '0.0.0.0',
      PORT: '8080',
      LOG_LEVEL: 'debug',
      CORS_ORIGINS: 'http://app.local,http://test.local',
      DATABASE_URL: 'postgresql://user:pass@test-host:5432/testdb'
    };

    const config = loadConfig(mockEnv);
    
    expect(config.NODE_ENV).toBe('test');
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.PORT).toBe(8080);
    expect(config.LOG_LEVEL).toBe('debug');
    expect(config.CORS_ORIGINS).toEqual(['http://app.local', 'http://test.local']);
    expect(config.DATABASE_URL).toBe('postgresql://user:pass@test-host:5432/testdb');
  });

  it('uses safe defaults when values are missing', () => {
    const config = loadConfig({});
    
    expect(config.NODE_ENV).toBe('development');
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.PORT).toBe(3001);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });
});
