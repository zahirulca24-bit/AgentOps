import { describe, expect, it } from 'vitest';
import type { BrowserContext, Page } from 'playwright';
import type { EnvConfig } from '../../src/config/env.js';
import {
  BrowserSession,
  type CapturedConsoleLog,
  type CapturedNetworkLog,
} from '../../src/infrastructure/browser/browser.session.js';

const createSession = () => new BrowserSession(
  'assertion-test',
  {} as BrowserContext,
  {} as Page,
  {} as EnvConfig,
  true,
);

const setConsoleLogs = (session: BrowserSession, logs: CapturedConsoleLog[]) => {
  (session as unknown as { consoleLogs: CapturedConsoleLog[] }).consoleLogs = logs;
};

const setNetworkLogs = (session: BrowserSession, logs: CapturedNetworkLog[]) => {
  (session as unknown as { networkLogs: CapturedNetworkLog[] }).networkLogs = logs;
};

const timestamp = '2026-09-14T00:00:00.000Z';

describe('BrowserSession no_console_error assertion', () => {
  it('passes when no console error or assert entries are captured', async () => {
    const session = createSession();
    setConsoleLogs(session, [
      { type: 'log', text: 'normal output', timestamp },
      { type: 'warning', text: 'warning only', timestamp },
    ]);

    await expect(session.evaluateAssertion('no_console_error')).resolves.toEqual({
      pass: true,
      actual: 'No console errors detected',
    });
  });

  it('fails for captured console errors/assert failures without leaking message content', async () => {
    const session = createSession();
    setConsoleLogs(session, [
      { type: 'error', text: 'secret-token=do-not-leak', timestamp },
      { type: 'assert', text: 'private assertion details', timestamp },
    ]);

    const result = await session.evaluateAssertion('no_console_error');

    expect(result.pass).toBe(false);
    expect(result.actual).toBe('Found 2 console failure entries (1 error, 1 assert)');
    expect(result.actual).not.toContain('secret-token');
    expect(result.actual).not.toContain('private assertion details');
  });
});

describe('BrowserSession no_failed_request assertion', () => {
  it('passes when captured HTTP responses are successful', async () => {
    const session = createSession();
    setNetworkLogs(session, [
      { url: 'https://example.com/api/items', method: 'GET', status: 200, timestamp },
      { url: 'https://example.com/api/pending', method: 'GET', timestamp },
    ]);

    await expect(session.evaluateAssertion('no_failed_request')).resolves.toEqual({
      pass: true,
      actual: 'No failed HTTP responses detected',
    });
  });

  it('fails for HTTP status >= 400 and strips query/hash data from URL summaries', async () => {
    const session = createSession();
    setNetworkLogs(session, [
      { url: 'https://example.com/api/orders?token=secret#private', method: 'GET', status: 404, timestamp },
      { url: 'https://example.com/api/admin?key=hidden', method: 'POST', status: 500, timestamp },
    ]);

    const result = await session.evaluateAssertion('no_failed_request');

    expect(result.pass).toBe(false);
    expect(result.actual).toBe('Found 2 failed HTTP responses: 404 https://example.com/api/orders; 500 https://example.com/api/admin');
    expect(result.actual).not.toContain('token=secret');
    expect(result.actual).not.toContain('key=hidden');
    expect(result.actual).not.toContain('#private');
  });
});
