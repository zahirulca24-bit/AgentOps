import type { AIProvider } from '../../core/ai/provider.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';
import { HumanApprovalService } from '../approval/approval.service.js';
import { PermissionEngineService } from '../permission/permission.service.js';
import type { Database } from '../../infrastructure/db/client.js';
import { projects } from '../../infrastructure/db/schema.js';
import type { BrowserWorkerService, BrowserWorkerWorkflowStep, BrowserWorkerSchedule } from '../browser-workers/browser-worker.service.js';
import { ChiefOfStaffMemory } from './chief-of-staff.service.js';

export type ChatIntent = 'qa' | 'runs' | 'issues' | 'reports' | 'github' | 'deploy' | 'browser_worker_create';

const destinations: Record<ChatIntent, string> = {
  qa: '/command', runs: '/runs', issues: '/issues', reports: '/reports', github: '/issues', deploy: '/automation', browser_worker_create: '/automation',
};

type BrowserWorkerLoginDraft = {
  loginUrl?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  logoutSelector?: string;
};

type BrowserWorkerDraft = {
  projectId?: string;
  projectName?: string;
  targetUrl?: string;
  name?: string;
  environment?: string;
  scheduleType?: BrowserWorkerSchedule;
  credentialSecretRef?: string;
  loginConfig?: BrowserWorkerLoginDraft;
  checks?: Array<{
    type?: 'login' | 'navigate' | 'click' | 'fill' | 'submit' | 'wait' | 'logout';
    url?: string;
    selector?: string;
    value?: string;
    timeoutMs?: number;
  }>;
};

type ParsedCommand = { intent: ChatIntent; summary: string; browserWorker?: BrowserWorkerDraft };

const schema = {
  type: 'object', properties: {
    intent: { type: 'string', enum: ['qa', 'runs', 'issues', 'reports', 'github', 'deploy', 'browser_worker_create'] },
    summary: { type: 'string' },
    browserWorker: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        targetUrl: { type: 'string' },
        name: { type: 'string' },
        environment: { type: 'string' },
        scheduleType: { type: 'string', enum: ['on_demand', 'hourly', 'daily', 'weekly'] },
        credentialSecretRef: { type: 'string' },
        loginConfig: {
          type: 'object', properties: {
            loginUrl: { type: 'string' }, usernameSelector: { type: 'string' }, passwordSelector: { type: 'string' }, submitSelector: { type: 'string' }, logoutSelector: { type: 'string' },
          },
        },
        checks: {
          type: 'array', items: {
            type: 'object', properties: {
              type: { type: 'string', enum: ['login', 'navigate', 'click', 'fill', 'submit', 'wait', 'logout'] },
              url: { type: 'string' }, selector: { type: 'string' }, value: { type: 'string' }, timeoutMs: { type: 'number' },
            }, required: ['type'],
          },
        },
      },
    },
  }, required: ['intent', 'summary'],
};

function normalizeUrlForMatch(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function toWorkflow(checks: BrowserWorkerDraft['checks'], targetUrl?: string): BrowserWorkerWorkflowStep[] | undefined {
  if (!checks?.length) return undefined;
  const workflow: BrowserWorkerWorkflowStep[] = [];
  for (const check of checks) {
    if (check.type === 'login') workflow.push({ type: 'login' });
    else if (check.type === 'navigate' && (check.url || targetUrl)) workflow.push({ type: 'navigate', url: check.url || targetUrl! });
    else if (check.type === 'click' && check.selector) workflow.push({ type: 'click', selector: check.selector });
    else if (check.type === 'fill' && check.selector && check.value !== undefined) workflow.push({ type: 'fill', selector: check.selector, value: check.value });
    else if (check.type === 'submit' && check.selector) workflow.push({ type: 'submit', selector: check.selector });
    else if (check.type === 'wait') workflow.push({ type: 'wait', timeoutMs: check.timeoutMs });
    else if (check.type === 'logout') workflow.push({ type: 'logout', selector: check.selector });
  }
  return workflow.length ? workflow : undefined;
}

export class CommandChatService {
  private memory: ChiefOfStaffMemory;
  constructor(
    private aiProvider: AIProvider,
    private permissionEngine = new PermissionEngineService(),
    private approvals = new HumanApprovalService(),
    private db?: Database,
    private browserWorkers?: Pick<BrowserWorkerService, 'createWorker'>,
  ) { this.memory = new ChiefOfStaffMemory(db); }

  async dispatch(command: string, context: { page: string; runId?: string }, actor = 'command-chat-user') {
    const safeCommand = redactString(command);
    const memories = await this.memory.retrieve(safeCommand);
    await this.memory.communicate(actor, 'Chief of Staff', safeCommand);
    const parsed = await this.aiProvider.generateStructuredQA<ParsedCommand>({
      taskCommand: safeCommand,
      analysisContext: { page: context.page, runId: context.runId, retrievedMemory: memories },
      promptOverride: `Classify this AgentOps command into qa, runs, issues, reports, github, deploy, or browser_worker_create. Use browser_worker_create for requests to create/set up/provision a browser worker or recurring browser check. For browser_worker_create, extract only values explicitly supplied by the user: existing project ID/name or app URL, worker name, environment, schedule (on_demand/hourly/daily/weekly), credential secret_ref, login selectors/config, and concrete browser checks as login/navigate/click/fill/submit/wait/logout steps. Do not invent selectors, credentials, project IDs, or URLs. Return only the requested JSON. Command: ${safeCommand}`,
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

    if (permission.outcome !== 'allow') {
      const summary = redactString(parsed.summary); await this.memory.communicate('Chief of Staff', specialist, summary, specialist.toLowerCase().replaceAll(' ', '_')); await this.memory.remember('failure_pattern', specialist, summary, { action, outcome: permission.outcome }); return { intent, specialist, summary, destination: destinations[intent], progress: [...progress, 'Action blocked by policy'], permission, status: 'blocked' as const };
    }

    if (intent === 'browser_worker_create') {
      return this.createBrowserWorkerFromChat(parsed, specialist, permission, progress);
    }

    const summary = redactString(parsed.summary); await this.memory.communicate('Chief of Staff', specialist, summary, specialist.toLowerCase().replaceAll(' ', '_')); await this.memory.remember('outcome', specialist, summary, { action, outcome: permission.outcome }); return { intent, specialist, summary, destination: destinations[intent], progress: [...progress, 'Action ready'], permission, status: 'ready' as const };
  }

  private async createBrowserWorkerFromChat(parsed: ParsedCommand, specialist: string, permission: any, progress: string[]) {
    const draft = parsed.browserWorker || {};
    let projectId = draft.projectId?.trim();
    const requestedUrl = normalizeUrlForMatch(draft.targetUrl);

    if (!projectId && this.db && (draft.projectName || requestedUrl)) {
      const allProjects = await this.db.select().from(projects);
      const projectName = draft.projectName?.trim().toLowerCase();
      const match = allProjects.find((project: any) =>
        (projectName && String(project.name || '').trim().toLowerCase() === projectName) ||
        (requestedUrl && normalizeUrlForMatch(project.targetUrl) === requestedUrl)
      );
      projectId = match?.id;
    }

    const missingFields: string[] = [];
    if (!projectId) missingFields.push('projectId');

    const login = draft.loginConfig;
    if (draft.credentialSecretRef) {
      if (!login?.loginUrl) missingFields.push('loginConfig.loginUrl');
      if (!login?.usernameSelector) missingFields.push('loginConfig.usernameSelector');
      if (!login?.passwordSelector) missingFields.push('loginConfig.passwordSelector');
      if (!login?.submitSelector) missingFields.push('loginConfig.submitSelector');
    }

    if (missingFields.length) {
      const summary = redactString(`I can create the Browser Worker once you provide: ${missingFields.join(', ')}.`);
      await this.memory.communicate('Chief of Staff', specialist, summary, 'browser_worker');
      return { intent: 'browser_worker_create' as const, specialist, summary, destination: destinations.browser_worker_create, progress: [...progress, 'Waiting only for required Browser Worker fields'], permission, status: 'needs_input' as const, missingFields };
    }

    if (!this.browserWorkers) {
      const summary = 'Browser Worker execution service is unavailable.';
      return { intent: 'browser_worker_create' as const, specialist, summary, destination: destinations.browser_worker_create, progress: [...progress, 'Browser Worker service unavailable'], permission, status: 'blocked' as const };
    }

    const worker = await this.browserWorkers.createWorker({
      projectId: projectId!,
      name: draft.name?.trim() || 'Browser Worker',
      environment: draft.environment?.trim() || 'test',
      targetUrl: draft.targetUrl?.trim() || undefined,
      scheduleType: draft.scheduleType || 'on_demand',
      credentialSecretRef: draft.credentialSecretRef?.trim() || null,
      loginConfig: draft.credentialSecretRef ? {
        loginUrl: login!.loginUrl!,
        usernameSelector: login!.usernameSelector!,
        passwordSelector: login!.passwordSelector!,
        submitSelector: login!.submitSelector!,
        logoutSelector: login!.logoutSelector,
      } : null,
      workflow: toWorkflow(draft.checks, draft.targetUrl),
    });

    const summary = redactString(`Browser Worker ${worker.id} created with status ${worker.status}.`);
    await this.memory.communicate('Chief of Staff', specialist, summary, 'browser_worker');
    await this.memory.remember('outcome', specialist, summary, { action: 'create_browser_worker', workerId: worker.id, status: worker.status });
    return { intent: 'browser_worker_create' as const, specialist, summary, destination: destinations.browser_worker_create, progress: [...progress, 'Browser Worker created directly from chat'], permission, status: 'executed' as const, worker: { id: worker.id, status: worker.status, scheduleType: worker.scheduleType, name: worker.name } };
  }

  private actionFor(intent: ChatIntent, command: string) {
    if (intent === 'qa') return 'trigger_qa_run';
    if (intent === 'runs') return 'list_runs';
    if (intent === 'issues') return 'view_report';
    if (intent === 'reports') return 'view_report';
    if (intent === 'github') return 'read_code';
    if (intent === 'browser_worker_create') return 'create_browser_worker';
    return /\b(prod|production|live)\b/i.test(command) ? 'deploy_production' : 'create_preview_deployment';
  }
  private specialistFor(intent: ChatIntent, command: string) { if (intent === 'qa') return 'QA'; if (intent === 'browser_worker_create') return 'Browser Worker'; if (intent === 'github') return 'GitHub'; if (intent === 'deploy') return 'Deploy'; if (/security|secret|credential/i.test(command)) return 'Security'; if (/database|sql|migration/i.test(command)) return 'Database'; if (/email|mail/i.test(command)) return 'Email'; if (/calendar|meeting/i.test(command)) return 'Calendar'; if (/message|slack|teams/i.test(command)) return 'Messaging'; if (/bug|issue|error/i.test(command)) return 'Bug Finder'; return 'Coding'; }
}
