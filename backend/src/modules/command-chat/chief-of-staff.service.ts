import { desc, ilike, or } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { agentCommunicationLogs, agentMemoryEntries } from '../../infrastructure/db/schema.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';

export const SPECIALISTS = [
  ['coding', 'Coding', 'Code changes and reviews', 'Yellow'], ['bug_finder', 'Bug Finder', 'Issue triage and root-cause analysis', 'Green'], ['qa', 'QA', 'Test planning and execution', 'Yellow'], ['github', 'GitHub', 'Repository, branches and pull requests', 'Yellow'], ['deploy', 'Deploy', 'Preview and production deployments', 'Red'], ['security', 'Security', 'Security scans and credential safety', 'Red'], ['database', 'Database', 'Query analysis and migrations', 'Red'], ['email', 'Email', 'Email drafting and sending', 'Red'], ['calendar', 'Calendar', 'Calendar planning and updates', 'Red'], ['messaging', 'Messaging', 'Message drafting and delivery', 'Red'],
] as const;

export class ChiefOfStaffMemory {
  constructor(private db?: Database) {}
  async remember(kind: string, subject: string, content: string, metadata?: unknown) {
    const clean = redactString(content);
    if (this.db) try { await this.db.insert(agentMemoryEntries).values({ kind, subject: redactString(subject), content: clean, metadata: metadata as any }); } catch {}
  }
  async communicate(speaker: string, recipient: string, message: string, agent?: string) {
    const clean = redactString(message);
    if (this.db) try { await this.db.insert(agentCommunicationLogs).values({ speaker: redactString(speaker), recipient: redactString(recipient), agent, message: clean }); } catch {}
  }
  async retrieve(query: string) {
    if (!this.db) return [] as string[];
    try { const rows = await this.db.select().from(agentMemoryEntries).where(or(ilike(agentMemoryEntries.subject, `%${query.slice(0, 80)}%`), ilike(agentMemoryEntries.content, `%${query.slice(0, 80)}%`))).orderBy(desc(agentMemoryEntries.createdAt)).limit(6); return rows.map((r: { content: string }) => r.content); } catch { return []; }
  }
  async overview() {
    const logs = this.db ? await this.db.select().from(agentCommunicationLogs).orderBy(desc(agentCommunicationLogs.createdAt)).limit(80).catch(() => []) : [];
    return SPECIALISTS.map(([id, name, capability, permission]) => { const latest = logs.find((log: any) => log.agent === id); return { id, name, capability, permission, status: latest ? 'Active' : 'Idle', currentTask: latest?.message || null, lastActivity: latest?.createdAt || null }; });
  }
  async log() { return this.db ? this.db.select().from(agentCommunicationLogs).orderBy(desc(agentCommunicationLogs.createdAt)).limit(100).catch(() => []) : []; }
}
