import { AppError } from '../../core/errors.js';
import type { Page, Route, Request } from 'playwright';
import { validateUrlSafe } from '../url/validateUrl.js';

export class BrowserSecurity {
  constructor(private allowLocalhostForTests = false) {}

  public async validateUrlSafe(urlString: string): Promise<void> {
    return validateUrlSafe(urlString, this.allowLocalhostForTests);
  }

  public async applyToPage(page: Page) {
    // Prevent SSRF via redirects or asset loading
    await page.route('**/*', async (route: Route, request: Request) => {
      const url = request.url();
      
      try {
        await this.validateUrlSafe(url);
        await route.continue();
      } catch (err) {
        // Block navigation/request if it fails validation
        await route.abort('accessdenied');
      }
    });
  }
}
