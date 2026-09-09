import type { AIProvider } from '../../core/ai/provider.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';
import { HumanApprovalService } from '../approval/approval.service.js';
import { PermissionEngineService } from '../permission/permission.service.js';
import type { Database } from '../../infrastructure/db/client.js';
import { ChiefOfStaffMemory } from './chief-of-staff.service.js';

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
  private memory: ChiefOfStaffMemory;
  constructor(private aiProvider: AIProvider, private permissionEngine = new PermissionEngineService(), private approvals = new HumanApprovalService(), db?: Database) { this.memory = new ChiefOfStaffMemory(db); }

  async dispatch(command: string, context: { page: string; runId?: string }, actor = 'command-chat-user') {
    const safeCommand = redactString(command);
    const memories = await this.memory.retrieve(safeCommand);
    await this.memory.communicate(actor, 'Chief of Staff', safeCommand);
    const parsed = await this.aiProvider.generateStructuredQA<{ intent: ChatIntent; summary: string }>({
      taskCommand: safeCommand,
      analysisContext: { page: context.page, runId: context.runId, retrievedMemory: memories },
      promptOverride: `Classify this AgentOps command into qa, runs, issues, reports, github, or deploy. Return only the requested JSON. Command: ${safeCommand}`,
    }, schema);
    const intent = destinations[parsed.intent] ? parsed.intent : 'qa';
    const action = this.actionFor(intent, safeCommand);
    const specialist = this.specialistFor(intent, safeCommand);
    const permission = await this.permissionEngine.evaluatePermission({ action, actor, resourceId: context.runId, context: { page: context.page } });
    const progress = ['Intent parsed by Chief of Staff', `Permission Engine: ${permission.tier} tier`, `Routed to ${specialist}`];

    if (permission.outcome === 'human_approval_required') {
      const approval = await this.approvals.createApprovalRequest({
        actionCategory: 'PRODUCTION_DEPLOYMENT', actionSummary: safeCommand, requestedBy: actor, resourceId: context.runId,
        reason: 'Requested from the global AI Command Chat',
      });
      const summary = redactString(parsed.summary); await this.memory.communicate('Chief of Staff', specialist, summary, specialist.toLowerCase().replaceAll(' ', '_')); await this.memory.remember('approval', specialist, summary, { approvalId: approval.approvalId }); return { intent, specialist, summary, destination: destinations[intent], progress: [...progress, 'Execution paused for human approval'], permission, approval, status: 'approval_required' as const };
    }
    const summary = redactString(parsed.summary); await this.memory.communicate('Chief of Staff', specialist, summary, specialist.toLowerCase().replaceAll(' ', '_')); await this.memory.remember(permission.outcome === 'allow' ? 'outcome' : 'failure_pattern', specialist, summary, { action, outcome: permission.outcome }); return { intent, specialist, summary, destination: destinations[intent], progress: [...progress, permission.outcome === 'allow' ? 'Action ready' : 'Action blocked by policy'], permission, status: permission.outcome === 'allow' ? 'ready' as const : 'blocked' as const };
  }

  private actionFor(intent: ChatIntent, command: string) {
    if (intent === 'qa') return 'trigger_qa_run';
    if (intent === 'runs') return 'list_runs';
    if (intent === 'issues') return 'view_report';
    if (intent === 'reports') return 'view_report';
    if (intent === 'github') return 'read_code';
    return /\b(prod|production|live)\b/i.test(command) ? 'deploy_production' : 'create_preview_deployment';
  }
  private specialistFor(intent: ChatIntent, command: string) { if (intent === 'qa') return 'QA'; if (intent === 'github') return 'GitHub'; if (intent === 'deploy') return 'Deploy'; if (/security|secret|credential/i.test(command)) return 'Security'; if (/database|sql|migration/i.test(command)) return 'Database'; if (/email|mail/i.test(command)) return 'Email'; if (/calendar|meeting/i.test(command)) return 'Calendar'; if (/message|slack|teams/i.test(command)) return 'Messaging'; if (/bug|issue|error/i.test(command)) return 'Bug Finder'; return 'Coding'; }
}
