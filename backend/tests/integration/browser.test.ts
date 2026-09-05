import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { BrowserManager } from '../../src/infrastructure/browser/browser.manager.js';
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
};

describe('Browser Engine Integration', () => {
  let app: FastifyInstance;
  let serverUrl: string;
  let managerAllow: BrowserManager;
  let managerBlock: BrowserManager;

  beforeAll(async () => {
    // 1. Setup a dummy local web server to test Playwright navigations against
    app = fastify();
    
    app.get('/', async (req, reply) => {
      reply.type('text/html').send(`
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Hello Playwright</h1>
            <input type="text" id="test-input" />
            <button id="test-btn">Click Me</button>
            <div id="result"></div>
            <script>
              document.getElementById('test-btn').addEventListener('click', () => {
                document.getElementById('result').innerText = 'Clicked';
              });
            </script>
          </body>
        </html>
      `);
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as any;
    serverUrl = `http://127.0.0.1:${address.port}`;

    // 2. Instantiate managers
    // We explicitly allow localhost here for the good tests
    managerAllow = new BrowserManager(testConfig, true);
    await managerAllow.initialize();

    // Default manager (blocks localhost)
    managerBlock = new BrowserManager(testConfig, false);
    await managerBlock.initialize();
  }, 30000);

  afterAll(async () => {
    await managerAllow.cleanup();
    await managerBlock.cleanup();
    await app.close();
  });

  it('blocks disallowed URL schemes (file://, javascript://)', async () => {
    const session = await managerAllow.createSession();
    await expect(session.navigate({ url: 'file:///etc/passwd' })).rejects.toMatchObject({
      code: 'NAVIGATION_BLOCKED'
    });
    await expect(session.navigate({ url: 'javascript:alert(1)' })).rejects.toMatchObject({
      code: 'NAVIGATION_BLOCKED'
    });
    await managerAllow.closeSession(session.sessionId);
  });

  it('blocks localhost navigation by default (SSRF protection)', async () => {
    const session = await managerBlock.createSession();
    await expect(session.navigate({ url: serverUrl })).rejects.toMatchObject({
      code: 'NAVIGATION_BLOCKED'
    });
    await managerBlock.closeSession(session.sessionId);
  });

  it('allows navigation and explicit actions when security permits', async () => {
    const session = await managerAllow.createSession();
    
    // Navigate
    const navResult = await session.navigate({ url: serverUrl });
    expect(navResult.url).toBe(serverUrl + '/');
    expect(navResult.title).toBe('Test Page');
    expect(navResult.status).toBe(200);

    // Read state
    const state = await session.read();
    expect(state.title).toBe('Test Page');

    // Fill input
    await session.fill({ selector: '#test-input', value: 'secret_value' });

    // Click button
    await session.click({ selector: '#test-btn' });

    // Bounded screenshot (primitive only, no file storage assert here beyond return ref)
    const shot = await session.screenshot({ fullPage: false });
    expect(shot.storageRef).toContain('screenshot_');

    await managerAllow.closeSession(session.sessionId);
  });

  it('enforces concurrent session limits', async () => {
    const s1 = await managerAllow.createSession();
    const s2 = await managerAllow.createSession();
    
    await expect(managerAllow.createSession()).rejects.toMatchObject({
      code: 'ACTION_LIMIT_REACHED'
    });

    await managerAllow.closeSession(s1.sessionId);
    await managerAllow.closeSession(s2.sessionId);
  });
});
