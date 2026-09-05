import React, { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  CalendarDays,
  HardDrive,
  Mail,
  MessageCircle,
  Globe,
  Search,
  FlaskConical,
  PlayCircle,
  FileText,
  ShieldCheck,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Card, Badge, Button, Input } from '@/components/ui';

type Permission = 'Allowed' | 'Approval Required' | 'Denied';
type ToolId = 'calendar' | 'drive' | 'gmail' | 'whatsapp' | 'browser' | 'explorer' | 'generator' | 'executor' | 'reports';

type AgentTool = {
  id: ToolId;
  name: string;
  group: 'Personal tools' | 'QA tools';
  permission: Permission;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const tools: AgentTool[] = [
  { id: 'calendar', name: 'Google Calendar', group: 'Personal tools', permission: 'Approval Required', description: 'Create and manage calendar events.', icon: CalendarDays },
  { id: 'drive', name: 'Google Drive', group: 'Personal tools', permission: 'Allowed', description: 'Find and read connected Drive files.', icon: HardDrive },
  { id: 'gmail', name: 'Gmail', group: 'Personal tools', permission: 'Approval Required', description: 'Draft or send messages with approval.', icon: Mail },
  { id: 'whatsapp', name: 'WhatsApp', group: 'Personal tools', permission: 'Denied', description: 'Not connected in Phase 1 preview.', icon: MessageCircle },
  { id: 'browser', name: 'QA Browser', group: 'QA tools', permission: 'Allowed', description: 'Open pages and perform browser actions.', icon: Globe },
  { id: 'explorer', name: 'Website Explorer', group: 'QA tools', permission: 'Allowed', description: 'Discover pages, forms and flows.', icon: Search },
  { id: 'generator', name: 'Test Generator', group: 'QA tools', permission: 'Allowed', description: 'Generate structured QA test cases.', icon: FlaskConical },
  { id: 'executor', name: 'Test Executor', group: 'QA tools', permission: 'Allowed', description: 'Execute generated tests and assertions.', icon: PlayCircle },
  { id: 'reports', name: 'Reports', group: 'QA tools', permission: 'Allowed', description: 'Review test results and evidence.', icon: FileText },
];

function permissionVariant(permission: Permission) {
  if (permission === 'Allowed') return 'success' as const;
  if (permission === 'Denied') return 'danger' as const;
  return 'warning' as const;
}

function permissionIcon(permission: Permission) {
  if (permission === 'Allowed') return CheckCircle2;
  if (permission === 'Denied') return Ban;
  return AlertTriangle;
}

function detectTool(command: string): ToolId {
  const text = command.toLowerCase();
  if (text.includes('calendar') || text.includes('meeting')) return 'calendar';
  if (text.includes('drive') || text.includes('document') || text.includes('file')) return 'drive';
  if (text.includes('gmail') || text.includes('email') || text.includes('mail')) return 'gmail';
  if (text.includes('whatsapp')) return 'whatsapp';
  if (text.includes('report')) return 'reports';
  if (text.includes('generate') || text.includes('test case')) return 'generator';
  if (text.includes('execute') || text.includes('run test')) return 'executor';
  if (text.includes('explore')) return 'explorer';
  return 'browser';
}

export default function AgentPage() {
  const reduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<ToolId>('browser');
  const [activeId, setActiveId] = useState<ToolId | null>(null);
  const [command, setCommand] = useState('');
  const [activity, setActivity] = useState<string[]>(['Agent ready for a command.']);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const selected = useMemo(() => tools.find((tool) => tool.id === selectedId) ?? tools[0], [selectedId]);

  useEffect(() => {
    if (!approvalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setApprovalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [approvalOpen]);

  const submitCommand = (event: React.FormEvent) => {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;

    const toolId = detectTool(value);
    const tool = tools.find((item) => item.id === toolId) ?? tools[0];
    setSelectedId(tool.id);
    setActiveId(tool.id);
    setActivity([`Intent understood: “${value}”`, `Selected tool: ${tool.name}`, `Permission: ${tool.permission}`]);
    setApprovalOpen(tool.permission === 'Approval Required');
    setCommand('');
  };

  const approvePreview = () => {
    setApprovalOpen(false);
    setActivity((items) => [...items, 'Approval granted for this preview action.', 'Tool is ready to execute when the real connector is available.']);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">AI Agent</h1>
            <Badge variant="info" size="sm">Preview</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">One agent for QA and connected personal tools. No real external APIs are called here.</p>
        </div>
        <Badge variant="success" withDot>Agent ready</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="relative overflow-hidden p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0,transparent_38%)] opacity-[0.04]" />

          <div className="relative mx-auto flex min-h-[500px] max-w-5xl flex-col items-center justify-center gap-8">
            <motion.button
              type="button"
              onClick={() => setSelectedId(activeId ?? 'browser')}
              className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
              animate={reduceMotion ? undefined : { scale: activeId ? [1, 1.04, 1] : 1 }}
              transition={reduceMotion ? undefined : { duration: 1.8, repeat: activeId ? Infinity : 0 }}
              aria-label="AgentOps AI Agent"
            >
              {!reduceMotion && <span className="absolute inset-[-12px] rounded-full border border-primary/20 animate-ping" aria-hidden="true" />}
              <BrainCircuit className="h-11 w-11 text-primary" />
            </motion.button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AgentOps AI Agent</div>
              <p className="mt-1 text-xs text-muted-foreground">Intent → tool selection → permission check → execution</p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeId === tool.id;
                const isSelected = selectedId === tool.id;
                return (
                  <motion.button
                    key={tool.id}
                    type="button"
                    onClick={() => setSelectedId(tool.id)}
                    className={`relative rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${isSelected ? 'border-primary/60 bg-primary/5' : 'border-border bg-surface-muted/35 hover:border-border-strong'}`}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                  >
                    {isActive && <motion.span className="absolute inset-x-4 top-0 h-px bg-primary" layoutId="active-tool-line" />}
                    <div className="flex items-start gap-3">
                      <span className={`rounded-lg border p-2 ${isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-surface'}`}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{tool.name}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{tool.group}</span>
                      </span>
                      <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                    </div>
                    <Badge className="mt-3" variant={permissionVariant(tool.permission)} size="sm">{tool.permission}</Badge>
                  </motion.button>
                );
              })}
            </div>

            <form onSubmit={submitCommand} className="flex w-full gap-2 rounded-xl border border-border bg-surface p-2 shadow-sm">
              <Input value={command} onChange={(event) => setCommand(event.target.value)} aria-label="Agent command" placeholder="Ask AgentOps to test a site, find a Drive file, schedule a meeting…" />
              <Button type="submit" aria-label="Send command" disabled={!command.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Live Activity</h2>
              {activeId && <Badge variant="info" withDot>Selected</Badge>}
            </div>
            <div className="space-y-3" role="status" aria-live="polite" aria-atomic="false">
              {activity.map((item, index) => (
                <div key={`${item}-${index}`} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold">Tool Inspector</h2>
            <div className="mt-4 flex items-start gap-3">
              <span className="rounded-lg border border-border bg-surface-muted p-2"><selected.icon className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-semibold">{selected.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface-muted/40 p-3">
              <span className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="h-4 w-4 text-primary" /> Permission</span>
              <Badge variant={permissionVariant(selected.permission)}>{selected.permission}</Badge>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold">Permission model</h2>
            <div className="mt-3 space-y-2">
              {(['Allowed', 'Approval Required', 'Denied'] as Permission[]).map((permission) => {
                const Icon = permissionIcon(permission);
                return <div key={permission} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2"><Icon className="h-4 w-4" />{permission}</span><Badge variant={permissionVariant(permission)}>{permission === 'Allowed' ? 'Auto' : permission === 'Denied' ? 'Blocked' : 'Ask'}</Badge></div>;
              })}
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {approvalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-end bg-black/25 p-3 sm:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setApprovalOpen(false)}
          >
            <motion.div
              role="dialog" aria-modal="true" aria-label="Approval required"
              className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
              initial={reduceMotion ? undefined : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduceMotion ? undefined : { y: 20, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <Badge variant="warning">Approval Required</Badge>
              <h2 className="mt-3 text-lg font-semibold">Allow {selected.name}?</h2>
              <p className="mt-2 text-sm text-muted-foreground">This is a UI preview only. Approving does not call Google, Gmail, WhatsApp, or any external service.</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setApprovalOpen(false)}>Cancel</Button>
                <Button onClick={approvePreview}>Approve preview</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
