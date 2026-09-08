import { describe, expect, it } from 'vitest';
import { INITIAL_INTEGRATIONS, connectionAuditEntry, toggleIntegration } from './settings-workspace';

describe('settings workspace integration state', () => {
  it('toggles only the requested connection', () => {
    const updated = toggleIntegration(INITIAL_INTEGRATIONS, 'vercel');
    expect(updated.find((item) => item.id === 'vercel')?.status).toBe('connected');
    expect(updated.find((item) => item.id === 'github')?.status).toBe('connected');
  });

  it('keeps audit entries reference-only', () => {
    const entry = connectionAuditEntry(INITIAL_INTEGRATIONS[0], 'tested');
    expect(entry).toContain('vault://integrations/github/primary');
    expect(entry).not.toMatch(/token=|password=|secret=/i);
  });
});
