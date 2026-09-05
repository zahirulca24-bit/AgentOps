import type { BrowserManager } from '../../infrastructure/browser/browser.manager.js';
import type { EnvConfig } from '../../config/env.js';
import { FlowDetector } from './flow-detector.js';
import { pageObservationSchema, type WebsiteMap, type PageObservation } from './explorer.schema.js';

export class ExplorerService {
  private flowDetector = new FlowDetector();

  constructor(
    private browserManager: BrowserManager,
    private config: EnvConfig
  ) {}

  public async exploreSite(startUrl: string): Promise<WebsiteMap> {
    const session = await this.browserManager.createSession();
    const map: WebsiteMap = {
      startUrl,
      pagesObserved: 0,
      observations: {},
      flowCandidates: [],
    };

    const toVisit: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
    const visited = new Set<string>();
    let startOrigin: string | null = null;
    
    try {
      const parsedStart = new URL(startUrl);
      startOrigin = parsedStart.origin;
    } catch {
      // Invalid URL handled by navigate
    }

    try {
      while (toVisit.length > 0 && map.pagesObserved < this.config.MAX_EXPLORATION_PAGES) {
        const { url, depth } = toVisit.shift()!;
        
        // Skip duplicate or dangerous URLs early
        if (visited.has(url)) continue;
        visited.add(url);
        
        if (this.isDangerousUrl(url)) continue;

        try {
          const navResult = await session.navigate({ url });
          if (!navResult.url) continue;

          // Enforce Same-Site Boundary
          try {
            const currentOrigin = new URL(navResult.url).origin;
            if (startOrigin && currentOrigin !== startOrigin) {
              // We landed outside the boundary. Stop this branch.
              continue;
            }
          } catch {
            continue;
          }

          // Read bounds
          const elements = await session.observeElements();
          
          const rawObservation = {
            url: navResult.url,
            title: navResult.title || '',
            ...elements
          };
          
          const observation = pageObservationSchema.parse(rawObservation);
          map.observations[navResult.url] = observation;
          map.pagesObserved++;

          // Detect flows
          const candidates = this.flowDetector.detectFlows(observation);
          map.flowCandidates.push(...candidates);

          // Queue new links if within depth
          if (depth < this.config.MAX_EXPLORATION_DEPTH) {
            for (const link of observation.links) {
              if (link.href && !visited.has(link.href) && !this.isDangerousUrl(link.href)) {
                // Prevent queueing obvious external links (same-site pre-filter)
                try {
                  const linkOrigin = new URL(link.href).origin;
                  if (startOrigin && linkOrigin === startOrigin) {
                    toVisit.push({ url: link.href, depth: depth + 1 });
                  }
                } catch {
                  // ignore bad hrefs
                }
              }
            }
          }
        } catch (err) {
          // Soft fail for navigation/observation errors to keep exploring other links
          console.warn(`Exploration failed for ${url}:`, err);
        }
      }
    } finally {
      await this.browserManager.closeSession(session.sessionId);
    }

    return map;
  }

  private isDangerousUrl(urlStr: string): boolean {
    const dangerousKeywords = ['delete', 'remove', 'logout', 'signout'];
    const lower = urlStr.toLowerCase();
    return dangerousKeywords.some(keyword => lower.includes(keyword));
  }
}
