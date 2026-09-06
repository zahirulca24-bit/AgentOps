import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { BrowserManager } from '../../src/infrastructure/browser/browser.manager.js';
import { ExecutionService } from '../../src/modules/execution/execution.service.js';
import type { EnvConfig } from '../../src/config/env.js';

const testConfig: EnvConfig = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3001,
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
};

describe('QA Execution Engine', () => {
  let app: FastifyInstance;
  let serverUrl: string;
  let browserManager: BrowserManager;
  let executionService: ExecutionService;
  
  // Mock DB tracking
  let mockRunState = 'pending';
  const mockInsertedResults: any[] = [];
  
  let currentTable = '';
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockImplementation((table) => {
      currentTable = table?.[Symbol.for('drizzle:Name')] || '';
      return mockDb;
    }),
    where: vi.fn().mockImplementation((condition) => {
      let results: any[] = [];
      const tableName = currentTable || condition?.table?.[Symbol.for('drizzle:Name')] || condition?.left?.table?.[Symbol.for('drizzle:Name')];
      if (tableName === 'runs') {
        results = [{ id: 'run-1', status: mockRunState }];
      }
      if (tableName === 'test_cases') {
        results = [
          {
            id: 'tc-1',
            runId: 'run-1',
            name: 'Passing Test',
            steps: [
              { action: 'navigate', target: serverUrl + '/' },
              { action: 'fill', target: '#search', value: 'hello' }
            ],
            assertions: [
              { type: 'element_visible', target: '#search' },
              { type: 'text_present', expected: 'Welcome' }
            ]
          },
          {
            id: 'tc-2',
            runId: 'run-1',
            name: 'Failing Product Test',
            steps: [
              { action: 'navigate', target: serverUrl + '/' }
            ],
            assertions: [
              { type: 'text_present', expected: 'Nonexistent Text' }
            ]
          },
          {
            id: 'tc-3',
            runId: 'run-1',
            name: 'Execution Error Test',
            steps: [
              { action: 'navigate', target: 'http://169.254.169.254' }
            ],
            assertions: []
          }
        ];
      }
      
      const mockChain = {
        limit: vi.fn().mockResolvedValue(results),
        then: function(resolve: any) { resolve(results); return mockChain; }
      };
      return mockChain;
    }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockImplementation((data) => {
      if (data.status) mockRunState = data.status;
      return { where: vi.fn() };
    }),
    insert: vi.fn().mockImplementation(() => {
      return {
        values: vi.fn().mockImplementation((data) => {
          mockInsertedResults.push(data);
          const chain = {
            returning: vi.fn().mockResolvedValue([data]),
            then: (resolve: any) => resolve([data]),
          };
          return chain;
        })
      };
    }),
  };

  beforeAll(async () => {
    app = fastify();
    
    app.get('/', async (req, reply) => {
      reply.type('text/html').send(`
        <html>
          <body>
            <h1>Welcome</h1>
            <input id="search" type="text" />
          </body>
        </html>
      `);
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as any;
    serverUrl = `http://127.0.0.1:${address.port}`;

    browserManager = new BrowserManager(testConfig, true); // true = allow localhost for testing
    await browserManager.initialize();
    
    executionService = new ExecutionService(mockDb, browserManager, testConfig);
  });

  afterAll(async () => {
    await browserManager.cleanup();
    await app.close();
  });

  it('rejects duplicate execution', async () => {
    mockRunState = 'running';
    await expect(executionService.executeRun('run-1')).rejects.toMatchObject({
      code: 'CONFLICT'
    });
  });

  it('executes tests sequentially and persists accurate statuses', async () => {
    mockRunState = 'pending';
    mockInsertedResults.length = 0; // reset
    
    // Will run 3 tests: one pass, one fail, one error
    await executionService.executeRun('run-1');
    
    const testCaseResults = mockInsertedResults.filter(r => r.testCaseId);
    expect(testCaseResults).toHaveLength(3);
    
    // Passing Test
    const passResult = mockInsertedResults.find(r => r.testCaseId === 'tc-1');
    expect(passResult.status).toBe('passed');
    expect(passResult.assertions).toHaveLength(2);
    expect(passResult.assertions[0].pass).toBe(true);

    // Failing Test
    const failResult = mockInsertedResults.find(r => r.testCaseId === 'tc-2');
    expect(failResult.status).toBe('failed');
    expect(failResult.screenshotRef).toBeDefined(); // should capture screenshot
    expect(failResult.errorMessage).toContain('Assertion failed: text_present');

    // Error Test
    const errorResult = mockInsertedResults.find(r => r.testCaseId === 'tc-3');
    expect(errorResult.status).toBe('error');
    expect(errorResult.errorMessage).toContain('Navigation blocked'); // SSRF triggers

    // Aggregated run state
    expect(mockRunState).toBe('error'); // because one test had an infra error
  });
});
