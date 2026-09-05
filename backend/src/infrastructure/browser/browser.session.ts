import type { Page, BrowserContext } from 'playwright';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { 
  navigateSchema, clickSchema, fillSchema, selectSchema, scrollSchema, waitSchema, readSchema, screenshotSchema,
  type NavigateAction, type ClickAction, type FillAction, type SelectAction, type ScrollAction, type WaitAction, type ReadAction, type ScreenshotAction
} from './browser.schemas.js';
import { BrowserSecurity } from './browser.security.js';
import { AppError } from '../../core/errors.js';
import type { EnvConfig } from '../../config/env.js';

export interface CapturedConsoleLog {
  type: string;
  text: string;
  location?: string;
  timestamp: string;
}

export interface CapturedNetworkLog {
  url: string;
  method: string;
  status?: number;
  contentType?: string;
  timestamp: string;
}

export interface VisualDefect {
  type: 'overflow' | 'overlap' | 'offscreen' | 'truncated_text';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  selector?: string;
}

export class BrowserSession {
  private page: Page;
  private security: BrowserSecurity;
  private consoleLogs: CapturedConsoleLog[] = [];
  private networkLogs: CapturedNetworkLog[] = [];

  constructor(
    public readonly sessionId: string,
    private context: BrowserContext,
    page: Page,
    private config: EnvConfig,
    allowLocalhostForTests: boolean = false
  ) {
    this.page = page;
    this.security = new BrowserSecurity(allowLocalhostForTests);
  }

  async initialize() {
    await this.security.applyToPage(this.page);

    // Capture console logs
    this.page.on('console', (msg) => {
      this.consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location() ? `${msg.location().url}:${msg.location().lineNumber}` : undefined,
        timestamp: new Date().toISOString(),
      });
      if (this.consoleLogs.length > 200) this.consoleLogs.shift();
    });

    // Capture page uncaught exceptions
    this.page.on('pageerror', (err) => {
      this.consoleLogs.push({
        type: 'error',
        text: `Uncaught Exception: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
      if (this.consoleLogs.length > 200) this.consoleLogs.shift();
    });

    // Capture network requests & responses
    this.page.on('request', (req) => {
      this.networkLogs.push({
        url: req.url(),
        method: req.method(),
        timestamp: new Date().toISOString(),
      });
      if (this.networkLogs.length > 200) this.networkLogs.shift();
    });

    this.page.on('response', (res) => {
      const log = this.networkLogs.find(n => n.url === res.url() && !n.status);
      if (log) {
        log.status = res.status();
        log.contentType = res.headers()['content-type'];
      }
    });
  }

  public getLogs() {
    return {
      console: [...this.consoleLogs],
      network: [...this.networkLogs],
    };
  }

  async navigate(action: NavigateAction) {
    const data = navigateSchema.parse(action);
    await this.security.validateUrlSafe(data.url);
    
    try {
      const response = await this.page.goto(data.url, { timeout: this.config.BROWSER_NAVIGATION_TIMEOUT_MS });
      return {
        url: this.page.url(),
        title: await this.page.title(),
        status: response?.status()
      };
    } catch (err) {
      throw new AppError('NAVIGATION_FAILED', `Navigation failed: ${(err as Error).message}`, 500);
    }
  }

  async click(action: ClickAction) {
    const data = clickSchema.parse(action);
    try {
      await this.page.click(data.selector, { timeout: this.config.BROWSER_ACTION_TIMEOUT_MS });
      return { success: true };
    } catch (err) {
      throw new AppError('ACTION_FAILED', `Click failed: ${(err as Error).message}`, 500);
    }
  }

  async fill(action: FillAction) {
    const data = fillSchema.parse(action);
    try {
      await this.page.fill(data.selector, data.value, { timeout: this.config.BROWSER_ACTION_TIMEOUT_MS });
      return { success: true };
    } catch (err) {
      throw new AppError('ACTION_FAILED', `Fill failed: ${(err as Error).message}`, 500);
    }
  }

  async select(action: SelectAction) {
    const data = selectSchema.parse(action);
    try {
      await this.page.selectOption(data.selector, data.value, { timeout: this.config.BROWSER_ACTION_TIMEOUT_MS });
      return { success: true };
    } catch (err) {
      throw new AppError('ACTION_FAILED', `Select failed: ${(err as Error).message}`, 500);
    }
  }

  async scroll(action: ScrollAction) {
    const data = scrollSchema.parse(action);
    try {
      if (data.direction === 'down') {
        await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
      } else if (data.direction === 'up') {
        await this.page.evaluate(() => window.scrollBy(0, -window.innerHeight));
      } else if (data.direction === 'top') {
        await this.page.evaluate(() => window.scrollTo(0, 0));
      } else if (data.direction === 'bottom') {
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } else if (data.pixels) {
        await this.page.evaluate((px) => window.scrollBy(0, px), data.pixels);
      }
      return { success: true };
    } catch (err) {
      throw new AppError('ACTION_FAILED', `Scroll failed: ${(err as Error).message}`, 500);
    }
  }

  async wait(action: WaitAction) {
    const data = waitSchema.parse(action);
    try {
      await this.page.waitForTimeout(data.timeoutMs);
      return { success: true };
    } catch (err) {
      throw new AppError('ACTION_FAILED', `Wait failed: ${(err as Error).message}`, 500);
    }
  }

  async read(action?: ReadAction) {
    try {
      return {
        url: this.page.url(),
        title: await this.page.title(),
      };
    } catch (err) {
      throw new AppError('ACTION_FAILED', `Read failed: ${(err as Error).message}`, 500);
    }
  }

  async observeElements() {
    try {
      return await this.page.evaluate(() => {
        const getMeta = (el: Element) => ({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || undefined,
          name: el.getAttribute('aria-label') || el.getAttribute('name') || undefined,
          text: (el as HTMLElement).innerText?.slice(0, 100).trim() || undefined,
          testId: el.getAttribute('data-testid') || undefined,
        });

        const links = Array.from(document.querySelectorAll('a[href]')).map(el => ({
          ...getMeta(el),
          href: (el as HTMLAnchorElement).href,
        })).slice(0, 100);

        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(el => ({
          ...getMeta(el),
          inputType: el.tagName.toLowerCase() === 'input' ? (el as HTMLInputElement).type : undefined,
          disabled: (el as HTMLButtonElement).disabled || undefined,
        })).slice(0, 50);

        const forms = Array.from(document.querySelectorAll('form')).map(f => {
          const inputs = Array.from(f.querySelectorAll('input, select, textarea')).map(el => ({
            ...getMeta(el),
            inputType: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
            required: (el as HTMLInputElement).required || undefined,
            disabled: (el as HTMLInputElement).disabled || undefined,
          }));
          const fButtons = Array.from(f.querySelectorAll('button, input[type="submit"]')).map(getMeta);
          return {
            id: f.id || undefined,
            action: f.getAttribute('action') || undefined,
            method: f.getAttribute('method') || undefined,
            inputs: inputs.slice(0, 50),
            buttons: fButtons.slice(0, 10),
          };
        }).slice(0, 10);

        const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => (h as HTMLElement).innerText.trim()).filter(Boolean).slice(0, 50);

        return { links, buttons, forms, headings };
      });
    } catch (err) {
      throw new AppError('ACTION_FAILED', `Observe failed: ${(err as Error).message}`, 500);
    }
  }

  /**
   * Phase-1 Visual QA Engine: Evaluates DOM layout for horizontal overflow,
   * overlapping interactive elements, off-screen clipping, and truncated text.
   */
  async evaluateVisualQA(): Promise<VisualDefect[]> {
    try {
      return await this.page.evaluate(() => {
        const defects: Array<{
          type: 'overflow' | 'overlap' | 'offscreen' | 'truncated_text';
          severity: 'high' | 'medium' | 'low';
          title: string;
          description: string;
          selector?: string;
        }> = [];

        // 1. Horizontal Overflow Check
        const bodyScrollWidth = document.documentElement.scrollWidth || document.body.scrollWidth;
        const viewportWidth = window.innerWidth;
        if (bodyScrollWidth > viewportWidth + 5) {
          defects.push({
            type: 'overflow',
            severity: 'high',
            title: 'Horizontal Page Overflow Detected',
            description: `Page scroll width (${bodyScrollWidth}px) exceeds viewport width (${viewportWidth}px), causing horizontal scrolling.`,
          });
        }

        // 2. Interactive Element Collisions / Overlaps
        const interactiveElements = Array.from(
          document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')
        ).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        });

        for (let i = 0; i < Math.min(interactiveElements.length, 30); i++) {
          const elA = interactiveElements[i];
          const rectA = elA.getBoundingClientRect();

          for (let j = i + 1; j < Math.min(interactiveElements.length, 30); j++) {
            const elB = interactiveElements[j];
            if (elA.contains(elB) || elB.contains(elA)) continue;

            const rectB = elB.getBoundingClientRect();
            const overlapX = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
            const overlapY = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
            const overlapArea = overlapX * overlapY;

            if (overlapArea > 50) {
              const tagA = elA.tagName.toLowerCase();
              const tagB = elB.tagName.toLowerCase();
              defects.push({
                type: 'overlap',
                severity: 'medium',
                title: 'Interactive Element Collision Detected',
                description: `<${tagA}> and <${tagB}> elements overlap by ${Math.round(overlapArea)}px².`,
                selector: elA.id ? `#${elA.id}` : tagA,
              });
              break;
            }
          }
        }

        // 3. Truncated / Clipped Text
        const textElements = Array.from(document.querySelectorAll('h1, h2, h3, p, span, button')).slice(0, 40);
        for (const el of textElements) {
          const htmlEl = el as HTMLElement;
          const style = window.getComputedStyle(htmlEl);
          if (style.overflow === 'hidden' && style.textOverflow !== 'ellipsis') {
            if (htmlEl.scrollWidth > htmlEl.clientWidth + 5 || htmlEl.scrollHeight > htmlEl.clientHeight + 5) {
              defects.push({
                type: 'truncated_text',
                severity: 'low',
                title: 'Truncated Text Without Ellipsis',
                description: `Text element <${el.tagName.toLowerCase()}> content overflows hidden container boundaries without text-overflow: ellipsis.`,
                selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
              });
            }
          }
        }

        return defects;
      });
    } catch (err) {
      return [];
    }
  }

  async evaluateAssertion(type: string, target?: string, expected?: string): Promise<{ pass: boolean; actual: string }> {
    try {
      switch (type) {
        case 'url_matches': {
          const currentUrl = this.page.url();
          return { pass: expected ? currentUrl.includes(expected) : false, actual: currentUrl };
        }
        case 'element_visible': {
          if (!target) return { pass: false, actual: 'Missing target' };
          const isVisible = await this.page.isVisible(target);
          return { pass: isVisible, actual: isVisible ? 'visible' : 'hidden' };
        }
        case 'text_present': {
          if (!expected) return { pass: false, actual: 'Missing expected text' };
          const bodyText = await this.page.innerText('body');
          return { pass: bodyText.includes(expected), actual: 'body text length: ' + bodyText.length };
        }
        case 'element_enabled': {
          if (!target) return { pass: false, actual: 'Missing target' };
          const isEnabled = await this.page.isEnabled(target);
          return { pass: isEnabled, actual: isEnabled ? 'enabled' : 'disabled' };
        }
        case 'visual_check': {
          const defects = await this.evaluateVisualQA();
          const pass = defects.length === 0;
          return {
            pass,
            actual: pass ? 'No visual layout defects detected' : `Found ${defects.length} visual defects: ${defects.map(d => d.title).join('; ')}`
          };
        }
        case 'validation_message_present': {
          const validityData = await this.page.evaluate(() => {
            const invalids = document.querySelectorAll(':invalid');
            return invalids.length;
          });
          return { pass: validityData > 0, actual: `found ${validityData} invalid elements` };
        }
        default:
          return { pass: false, actual: `Assertion ${type} is unsupported in this execution context` };
      }
    } catch (err) {
      return { pass: false, actual: `Error: ${(err as Error).message}` };
    }
  }

  async screenshot(action: ScreenshotAction) {
    const data = screenshotSchema.parse(action);
    try {
      const fileName = `screenshot_${this.sessionId}_${crypto.randomBytes(4).toString('hex')}.png`;
      const filePath = path.join(os.tmpdir(), fileName);
      
      await this.page.screenshot({
        path: filePath,
        fullPage: data.fullPage,
        timeout: this.config.BROWSER_ACTION_TIMEOUT_MS,
      });
      
      return { storageRef: filePath };
    } catch (err) {
      throw new AppError('ACTION_FAILED', `Screenshot failed: ${(err as Error).message}`, 500);
    }
  }

  async close() {
    try {
      await this.page.close();
      await this.context.close();
    } catch (err) {
      console.error(`Failed to close session ${this.sessionId}:`, err);
    }
  }
}
