import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, CirclePause, ExternalLink, Loader2, OctagonX, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { api, type ApiApprovalRequest, type ApiRun } from '@/lib/api';
import { Link } from '@/lib/router';
import { Badge, Button, Card, CardContent } from '@/components/ui';
import { toast } from 'sonner';

type WorkState = 'Running' | 'Waiting' | 'Approval Required' | 'Completed' | 'Failed';
type WorkCard = {
  id: string;
  kind: 'run' | 'approval';
  agent: string;
  project: string;
  task: string;
  state: WorkState;
  progress: number;
  progressLabel: string;
  currentAction: string;
  lastUpdate: string;
  runId?: string;
};

const STATES: WorkState[] = ['Running', 'Waiting', 'Approval Required', 'Completed', 'Failed'];

function runState(status: ApiRun['status']): WorkState {
  if (status === 'running') return 'Running';
  if (status === 'pending') return 'Waiting';
  if (status === 'passed' || status === 'completed') return 'Completed';
  return 'Failed';
}

function toRunCard(run: ApiRun): WorkCard {
  const results = run.testResults || [];
  const finished = results.filter((result) => !['pending', 'running'].includes(result.status)).length;
  const state = runState(run.status);
  const progress = state === 'Completed' || state === 'Failed' ? 100 : results.length ? Math.round((finished / results.length) * 100) : 0;
  const latestResult = results.at(-1);
  const action = state === 'Running'
    ? latestResult?.name ? `Executing ${latestResult.name}` : 'Preparing test execution'
    : state === 'Waiting' ? 'Queued for an available worker'
    : state === 'Completed' ? 'Execution completed'
    : latestResult?.errorMessage || 'Execution needs review';

  return {
    id: run.id,
    kind: 'run',
    agent: 'QA execution agent',
    project: run.task?.project?.name || 'Unassigned project',
    task: run.task?.command || 'No task command recorded',
    state,
    progress,
    progressLabel: results.length ? `${finished} of ${results.length} results finalized` : state === 'Waiting' ? 'Not started' : 'No test results recorded',
    currentAction: action,
    lastUpdate: run.completedAt || run.startedAt || run.createdAt,
    runId: run.id,
  };
}

function toApprovalCard(approval: ApiApprovalRequest): WorkCard {
  return {
    id: approval.approvalId,
    kind: 'approval',
    agent: approval.requestedBy,
    project: approval.resourceId || 'Protected resource',
    task: approval.actionSummary,
    state: 'Approval Required',
    progress: 50,
    progressLabel: 'Paused pending decision',
    currentAction: approval.actionCategory.replaceAll('_', ' ').toLowerCase(),
    lastUpdate: approval.updatedAt || approval.requestedAt,
  };
}

function relativeTime(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function stateVariant(state: WorkState) {
  return state === 'Running' ? 'info' : state === 'Waiting' || state === 'Approval Required' ? 'warning' : state === 'Completed' ? 'success' : 'danger';
}

function stateIcon(state: WorkState) {
  if (state === 'Running') return <Loader2 className="h-4 w-4 animate-spin" />;
  if (state === 'Waiting') return <CirclePause className="h-4 w-4" />;
  if (state === 'Approval Required') return <ShieldAlert className="h-4 w-4" />;
  if (state === 'Completed') return <CheckCircle2 className="h-4 w-4" />;
  return <XCircle className="h-4 w-4" />;
}

export function MissionControl() {
  const [runs, setRuns] = useState<ApiRun[]>([]);
  const [approvals, setApprovals] = useState<ApiApprovalRequest[]>([]);
  const [selected, setSelected] = useState<WorkState | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stopping, setStopping] = useState<string | null>(null);

  const loadWork = async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [runResponse, approvalResponse] = await Promise.all([api.listRuns(), api.listApprovals('pending')]);
      setRuns(runResponse.data);
      setApprovals(approvalResponse.data);
    } catch (error) {
      toast.error('Mission data is unavailable', { description: error instanceof Error ? error.message : 'Unable to load current work.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void loadWork(); }, []);
  const cards = useMemo(() => [...approvals.map(toApprovalCard), ...runs.map(toRunCard)], [approvals, runs]);
  const visibleCards = selected === 'All' ? cards : cards.filter((card) => card.state === selected);

  const stopRun = async (runId: string) => {
    setStopping(runId);
    try {
      await api.cancelRun(runId);
      toast.success('Agent stopped');
      await loadWork(true);
    } catch (error) {
      toast.error('Unable to stop agent', { description: error instanceof Error ? error.message : 'Please try again.' });
    } finally { setStopping(null); }
  };

  return <section aria-label="Current agent work" className="space-y-5">
    <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary"><Bot className="h-5 w-5" /></div>
        <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Live workspace</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Mission Control</h1><p className="mt-1 text-sm text-muted-foreground">Current work across the agents and projects connected to this workspace.</p></div>
      </div>
      <Button variant="outline" size="sm" onClick={() => void loadWork(true)} loading={refreshing} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>Refresh</Button>
    </div>

    <div className="flex flex-wrap gap-2" aria-label="Filter work by status">
      <button onClick={() => setSelected('All')} className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${selected === 'All' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:bg-surface-muted'}`}>All <span className="ml-1 opacity-80">{cards.length}</span></button>
      {STATES.map((state) => { const count = cards.filter((card) => card.state === state).length; return <button key={state} onClick={() => setSelected(state)} className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${selected === state ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:bg-surface-muted'}`}>{state} <span className="ml-1 opacity-80">{count}</span></button>; })}
    </div>

    {loading ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-xl border border-border bg-surface-muted/40" />)}</div> : visibleCards.length === 0 ? <Card className="border-dashed border-border bg-surface"><CardContent className="flex flex-col items-center gap-2 py-14 text-center"><AlertTriangle className="h-5 w-5 text-muted-foreground" /><p className="font-medium">No {selected === 'All' ? 'active or recorded' : selected.toLowerCase()} work</p><p className="max-w-sm text-sm text-muted-foreground">This view only shows work returned by the backend. Try another filter or refresh when new work is dispatched.</p></CardContent></Card> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleCards.map((card) => <Card key={`${card.kind}-${card.id}`} className="flex min-h-72 flex-col border-border bg-surface shadow-xs"><CardContent className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2 text-foreground">{stateIcon(card.state)}<span className="truncate text-sm font-semibold">{card.agent}</span></div><Badge variant={stateVariant(card.state)} withDot>{card.state}</Badge></div><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project / app</dt><dd className="mt-1 truncate text-foreground">{card.project}</dd></div><div><dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Task</dt><dd className="mt-1 line-clamp-2 leading-relaxed text-foreground">{card.task}</dd></div><div><dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current action</dt><dd className="mt-1 line-clamp-2 text-muted-foreground">{card.currentAction}</dd></div></dl><div className="mt-5"><div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-mono text-foreground">{card.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${card.progress}%` }} /></div><p className="mt-1.5 text-xs text-muted-foreground">{card.progressLabel}</p></div><div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4"><span className="text-xs text-muted-foreground">Updated {relativeTime(card.lastUpdate)}</span><div className="flex gap-2">{card.runId && <Link href={`/runs/${card.runId}`}><Button size="sm" variant="outline" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Details</Button></Link>}{card.state === 'Running' && card.runId && <Button size="sm" variant="danger" loading={stopping === card.runId} onClick={() => void stopRun(card.runId!)} leftIcon={<OctagonX className="h-3.5 w-3.5" />}>Stop</Button>}{card.state === 'Failed' && card.runId && <Link href={`/runs/${card.runId}?tab=logs`}><Button size="sm" variant="ghost">Logs</Button></Link>}</div></div></CardContent></Card>)}</div>}
  </section>;
}
