import type { AIProvider } from '../../core/ai/provider.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';
import { HumanApprovalService } from '../approval/approval.service.js';
import { PermissionEngineService } from '../permission/permission.service.js';

export type ChatIntent = 'qa' | 'runs' | 'issues' | 'reports' | 'github' | 'deploy';

const destinations: Record<ChatIntent, string> = {
  qa: '/command', runs: '/runs', issues: '/issues', reports: '/reports', github: '/issues', deploy: '/automation',
};

const schema = {
  type: 'object', properties: {
    intent: { type: 'string', enum: ['qa', 'runs', 'issues', 'reports', 'github', 'deploy'] },
    summary: { type: 'string' },
  }, required: ['intent', 'summary'],
};

export class CommandChatService {
  constructor(private aiProvider: AIProvider, private permissionEngine = new PermissionEngineService(), private approvals = new HumanApprovalService()) {}

  async dispatch(command: string, context: { page: string; runId?: string }, actor = 'command-chat-user') {
    const safeCommand = redactString(command);
    const parsed = await this.aiProvider.generateStructuredQA<{ intent: ChatIntent; summary: string }>({
      taskCommand: safeCommand,
      analysisContext: { page: context.page, runId: context.runId },
      promptOverride: `Classify this AgentOps command into qa, runs, issues, reports, github, or deploy. Return only the requested JSON. Command: ${safeCommand}`,
    }, schema);
    const intent = destinations[parsed.intent] ? parsed.intent : 'qa';
    const action = this.actionFor(intent, safeCommand);
    const permission = await this.permissionEngine.evaluatePermission({ action, actor, resourceId: context.runId, context: { page: context.page } });
    const progress = ['Intent parsed by AI provider', `Permission Engine: ${permission.tier} tier`, `Routing to ${intent} tools`];

    if (permission.outcome === 'human_approval_required') {
      const approval = await this.approvals.createApprovalRequest({
        actionCategory: 'PRODUCTION_DEPLOYMENT', actionSummary: safeCommand, requestedBy: actor, resourceId: context.runId,
        reason: 'Requested from the global AI Command Chat',
      });
      return { intent, summary: redactString(parsed.summary), destination: destinations[intent], progress: [...progress, 'Execution paused for human approval'], permission, approval, status: 'approval_required' as const };
    }
    return { intent, summary: redactString(parsed.summary), destination: destinations[intent], progress: [...progress, permission.outcome === 'allow' ? 'Action ready' : 'Action blocked by policy'], permission, status: permission.outcome === 'allow' ? 'ready' as const : 'blocked' as const };
  }

  private actionFor(intent: ChatIntent, command: string) {
    if (intent === 'qa') return 'trigger_qa_run';
    if (intent === 'runs') return 'list_runs';
    if (intent === 'issues') return 'view_report';
    if (intent === 'reports') return 'view_report';
    if (intent === 'github') return 'read_code';
    return /\b(prod|production|live)\b/i.test(command) ? 'deploy_production' : 'create_preview_deployment';
  }
}
