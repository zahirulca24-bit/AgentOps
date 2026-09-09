import { describe, expect, it } from 'vitest';
import { resolveEffectiveTargetUrl, resolveNavigationUrl } from '../../src/modules/execution/target-url.js';

describe('target URL propagation helpers', () => {
  it('falls through a malformed task URL to a valid project URL', () => {
    expect(resolveEffectiveTargetUrl({
      taskTargetUrl: 'not a valid url',
      projectTargetUrl: 'https://example.com/app',
    })).toBe('https://example.com/app');
  });

  it('extracts a valid command URL when stored URL fields are absent', () => {
    expect(resolveEffectiveTargetUrl({ command: 'Run QA against https://example.com/login now' }))
      .toBe('https://example.com/login');
  });

  it('repairs malformed generated navigation targets with the canonical URL', () => {
    expect(resolveNavigationUrl('not a valid url', 'https://example.com/app'))
      .toBe('https://example.com/app');
    expect(resolveNavigationUrl(undefined, 'https://example.com/app'))
      .toBe('https://example.com/app');
  });

  it('resolves relative navigation targets against the canonical URL', () => {
    expect(resolveNavigationUrl('/settings', 'https://example.com/app'))
      .toBe('https://example.com/settings');
  });
});
