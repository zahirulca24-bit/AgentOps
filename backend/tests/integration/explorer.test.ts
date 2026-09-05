import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { BrowserManager } from '../../src/infrastructure/browser/browser.manager.js';
import { ExplorerService } from '../../src/modules/explorer/explorer.service.js';
import type { EnvConfig } from '../../src/config/env.js';

const testConfig: EnvConfig = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3001,
  LOG_LEVEL: 'silent',
  CORS_ORIGINS: ['http://localhost:3000'],
  DATABASE_URL: 'postgresql://user:pass@test-host:5432/testdb',
  AI_MODEL: 'gemini-2.5-flash',
  MAX_CONCURRENT_SESSIONS: 2,
  BROWSER_ACTION_TIMEOUT_MS: 3000,
  BROWSER_NAVIGATION_TIMEOUT_MS: 5000,
  MAX_EXPLORATION_PAGES: 3, // Bounded for test
  MAX_EXPLORATION_DEPTH: 2,
};

describe('Website Explorer', () => {
  let app: FastifyInstance;
  let serverUrl: string;
  let browserManager: BrowserManager;
  let explorerService: ExplorerService;

  beforeAll(async () => {
    app = fastify();
    
    app.get('/', async (req, reply) => {
      reply.type('text/html').send(`
        <html>
          <head><title>Home</title></head>
          <body>
            <h1>Home</h1>
            <a href="/login">Go to Login</a>
            <a href="/about">About Us</a>
            <a href="https://example.com/external">External Link</a>
            <a href="/logout">Dangerous Link</a>
          </body>
        </html>
      `);
    });

    app.get('/login', async (req, reply) => {
      reply.type('text/html').send(`
        <html>
          <head><title>Login</title></head>
          <body>
            <h1>Login</h1>
            <form action="/auth" method="POST">
              <input type="email" name="user_email" required />
              <input type="password" name="password" required />
              <button type="submit">Sign In</button>
            </form>
            <a href="/">Back Home</a>
          </body>
        </html>
      `);
    });

    app.get('/about', async (req, reply) => {
      reply.type('text/html').send(`
        <html>
          <head><title>About</title></head>
          <body>
            <h1>About Us</h1>
            <a href="/">Back Home</a>
          </body>
        </html>
      `);
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as any;
    serverUrl = `http://127.0.0.1:${address.port}`;

    browserManager = new BrowserManager(testConfig, true);
    await browserManager.initialize();
    explorerService = new ExplorerService(browserManager, testConfig);
  });

  afterAll(async () => {
    await browserManager.cleanup();
    await app.close();
  });

  it('explores site boundaries, avoids duplicates, and detects flows', async () => {
    const map = await explorerService.exploreSite(serverUrl + '/');

    // Expected pages: /, /login, /about
    // Not expected: /logout (dangerous), external links (different origin)
    
    expect(map.pagesObserved).toBe(3);
    
    // Check observations
    const homeObs = map.observations[serverUrl + '/'];
    expect(homeObs.title).toBe('Home');
    expect(homeObs.links.length).toBe(4);
    
    const loginObs = map.observations[serverUrl + '/login'];
    expect(loginObs.title).toBe('Login');
    expect(loginObs.forms.length).toBe(1);

    // Check flows
    expect(map.flowCandidates.length).toBeGreaterThan(0);
    const loginCandidate = map.flowCandidates.find(f => f.type === 'login');
    expect(loginCandidate).toBeDefined();
    expect(loginCandidate?.confidence).toBeGreaterThan(0.8);
    expect(loginCandidate?.elements.some(e => e.inputType === 'password')).toBe(true);

    // Ensure external site not explored
    expect(map.observations['https://example.com/external']).toBeUndefined();
    // Ensure dangerous link not explored
    expect(map.observations[serverUrl + '/logout']).toBeUndefined();
  });
});
