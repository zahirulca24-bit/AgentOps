import { chromium, type Browser } from 'playwright';
import crypto from 'crypto';
import { BrowserSession } from './browser.session.js';
import type { EnvConfig } from '../../config/env.js';
import { AppError } from '../../core/errors.js';
import type { Database } from '../db/client.js';
import { browserSessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class BrowserManager {
  private browser: Browser | null = null;
  private sessions: Map<string, BrowserSession> = new Map();

  constructor(private config: EnvConfig, private allowLocalhostForTests: boolean = false) {}

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
      });
    }
  }

  async createSession(runId?: string, db?: Database): Promise<BrowserSession> {
    if (this.sessions.size >= this.config.MAX_CONCURRENT_SESSIONS) {
      throw new AppError('ACTION_LIMIT_REACHED', 'Maximum concurrent browser sessions reached', 429);
    }

    if (!this.browser) {
      await this.initialize();
    }

    const context = await this.browser!.newContext({
      permissions: [],
      acceptDownloads: false,
    });

    const page = await context.newPage();
    const sessionId = crypto.randomUUID();
    
    const session = new BrowserSession(sessionId, context, page, this.config, this.allowLocalhostForTests);
    await session.initialize();

    this.sessions.set(sessionId, session);

    // Persist browser session record in database if runId and db are provided
    if (runId && db) {
      try {
        await db.insert(browserSessions).values({
          id: sessionId,
          runId,
          status: 'active',
          startedAt: new Date(),
        });
      } catch (err) {
        // Ignore DB insert failure during session tracking to avoid breaking browser initialization
      }
    }

    return session;
  }

  getSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AppError('BROWSER_SESSION_NOT_FOUND', `Session ${sessionId} not found`, 404);
    }
    return session;
  }

  async closeSession(sessionId: string, db?: Database) {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.close();
      this.sessions.delete(sessionId);

      if (db) {
        try {
          await db.update(browserSessions)
            .set({ status: 'closed', endedAt: new Date() })
            .where(eq(browserSessions.id, sessionId));
        } catch (err) {
          // Ignore DB status update error on closing session
        }
      }
    }
  }

  async cleanup(db?: Database) {
    for (const [sessionId, session] of this.sessions.entries()) {
      await session.close();
      this.sessions.delete(sessionId);
      if (db) {
        try {
          await db.update(browserSessions)
            .set({ status: 'closed', endedAt: new Date() })
            .where(eq(browserSessions.id, sessionId));
        } catch (err) {}
      }
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
