import { describe, expect, it, vi } from 'vitest';
import { CommandChatService } from '../../src/modules/command-chat/command-chat.service.js';
import { AGENT_ACTIVITY_WINDOW_MS, isAgentActive } from '../../src/modules/command-chat/chief-of-staff.service.js';
import type { AIProvider } from '../../src/core/ai/provider.js';

const ai = (result: any): AIProvider => ({ generateStructuredQA: async () => typeof result === 'string' ? ({ intent: result, summary: 'token=do-not-display' }) : result });

describe('CommandChatService', () => {
  it('expires historical specialist activity instead of presenting it as live work', () => {
    const now = Date.now();
    expect(isAgentActive(new Date(now - AGENT_ACTIVITY_WINDOW_MS + 1), now)).toBe(true);
    expect(isAgentActive(new Date(now - AGENT_ACTIVITY_WINDOW_MS - 1), now)).toBe(false);
  });

  it('routes QA requests through the QA command workspace with policy evaluation', async () => {
    const result = await new CommandChatService(ai('qa')).dispatch('Test the checkout flow', { page: '/runs', runId: 'run-1' });
    expect(result.destination).toBe('/command');
    expect(result.specialist).toBe('QA');
    expect(result.permission.action).toBe('trigger_qa_run');
    expect(result.status).toBe('ready');
  });

  it('requires a human approval for production deploy instructions and redacts summaries', async () => {
    const result = await new CommandChatService(ai('deploy')).dispatch('Deploy to production with token=super-secret', { page: '/automation' });
    expect(result.status).toBe('approval_required');
    expect(result.approval?.status).toBe('pending');
    expect(result.summary).not.toContain('do-not-display');
  });

  it('asks only for unresolved required Browser Worker fields', async () => {
    const createWorker = vi.fn();
    const result = await new CommandChatService(
      ai({ intent: 'browser_worker_create', summary: 'Create an hourly browser worker', browserWorker: { scheduleType: 'hourly' } }),
      undefined,
      undefined,
      undefined,
      { createWorker } as any,
    ).dispatch('I need an hourly browser worker', { page: '/automation' });

    expect(result.intent).toBe('browser_worker_create');
    expect(result.specialist).toBe('Browser Worker');
    expect(result.permission.action).toBe('create_browser_worker');
    expect(result.permission.tier).toBe('Yellow');
    expect(result.status).toBe('needs_input');
    expect((result as any).missingFields).toEqual(['projectId']);
    expect(createWorker).not.toHaveBeenCalled();
  });

  it.each(['on_demand', 'hourly', 'daily', 'weekly'] as const)('creates a %s Browser Worker directly after permission validation', async (scheduleType) => {
    const createWorker = vi.fn(async (input: any) => ({ id: `worker-${scheduleType}`, status: 'idle', scheduleType: input.scheduleType, name: input.name }));
    const projectId = '11111111-1111-4111-8111-111111111111';
    const result = await new CommandChatService(
      ai({
        intent: 'browser_worker_create',
        summary: 'Create browser worker',
        browserWorker: {
          projectId,
          targetUrl: 'https://app.example.com',
          name: 'Checkout monitor',
          environment: 'staging',
          scheduleType,
          credentialSecretRef: 'secret://checkout-user',
          loginConfig: {
            loginUrl: '/login',
            usernameSelector: '#email',
            passwordSelector: '#password',
            submitSelector: 'button[type=submit]',
          },
          checks: [
            { type: 'navigate', url: '/checkout' },
            { type: 'click', selector: '#place-order' },
          ],
        },
      }),
      undefined,
      undefined,
      undefined,
      { createWorker } as any,
    ).dispatch('Create a browser worker for checkout', { page: '/automation' });

    expect(result.status).toBe('executed');
    expect((result as any).worker).toMatchObject({ id: `worker-${scheduleType}`, status: 'idle', scheduleType });
    expect(createWorker).toHaveBeenCalledWith(expect.objectContaining({
      projectId,
      targetUrl: 'https://app.example.com',
      scheduleType,
      credentialSecretRef: 'secret://checkout-user',
      workflow: [
        { type: 'navigate', url: '/checkout' },
        { type: 'click', selector: '#place-order' },
      ],
    }));
  });
});
