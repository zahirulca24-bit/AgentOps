import { describe, expect, it } from 'vitest';
import { CommandChatService } from '../../src/modules/command-chat/command-chat.service.js';
import type { AIProvider } from '../../src/core/ai/provider.js';

const ai = (intent: string): AIProvider => ({ generateStructuredQA: async () => ({ intent, summary: 'token=do-not-display' }) });

describe('CommandChatService', () => {
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
});
