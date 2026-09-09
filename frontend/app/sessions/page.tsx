'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Edit3,
  History,
  Loader2,
  Monitor,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Textarea } from '@/components/ui';
import { Link, usePathname } from '@/lib/router';
import { toast } from 'sonner';
import {
  browserWorkersApi,
  formatWorkerDate,
  scheduleLabel,
  type BrowserWorker,
  type BrowserWorkerProject,
  type BrowserWorkerSchedule,
  type BrowserWorkerWorkflowStep,
  type BrowserWorkerRun,
  type VaultSecretSummary,
} from '@/lib/browser-workers-api';

const scheduleOptions: BrowserWorkerSchedule[] = ['on_demand', 'hourly', 'daily', 'weekly'];
const defaultWorkflow = JSON.stringify([
  { type: 'navigate', url: '/' },
], null, 2);

function statusVariant(status: BrowserWorker['status']) {
  if (status === 'running') return 'info' as const;
  if (status === 'idle') return 'success' as const;
  if (status === 'paused') return 'warning' as const;
  return 'danger' as const;
}

export default function BrowserWorkersPage() {
  const id = usePathname().split('/').filter(Boolean)[1];
  return id ? <WorkerHistory workerId={id} /> : <WorkerList />;
}

function WorkerList() {
  const [workers, setWorkers] = useState<BrowserWorker[]>([]);
  const [projects, setProjects] = useState<BrowserWorkerProject[]>([]);
  const [secrets, setSecrets] = useState<VaultSecretSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrowserWorker | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [workerRes, projectRes, secretRes] = await Promise.all([
        browserWorkersApi.listWorkers(),
        browserWorkersApi.listProjects(),
        browserWorkersApi.listVaultSecrets(),
      ]);
      setWorkers(workerRes.data || []);
      setProjects(projectRes.data || []);
      setSecrets((secretRes.secrets || []).filter((secret) => secret.provider === 'generic' && secret.status === 'active'));
    } catch (error) {
      toast.error('Failed to load Browser Workers', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!workers.some((worker) => worker.status === 'running')) return;
    const interval = window.setInterval(() => void load(false), 3000);
    return () => window.clearInterval(interval);
  }, [workers.some((worker) => worker.status === 'running')]);

  const act = async (worker: BrowserWorker, action: 'run' | 'pause' | 'resume') => {
    setBusyId(worker.id);
    try {
      if (action === 'run') await browserWorkersApi.runNow(worker.id);
      if (action === 'pause') await browserWorkersApi.pause(worker.id);
      if (action === 'resume') await browserWorkersApi.resume(worker.id);
      toast.success(action === 'run' ? 'Browser Worker started' : action === 'pause' ? 'Browser Worker paused' : 'Browser Worker resumed');
      await load(false);
    } catch (error) {
      toast.error('Browser Worker action failed', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <span className="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary"><Monitor className="h-6 w-6" /></span>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Autonomous browsing</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Browser Workers</h1>
            <p className="mt-1 text-sm text-muted-foreground">On-demand and scheduled browser QA using real backend worker state, reports, history, and alerts.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} loading={loading} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
          <Button size="sm" onClick={() => { setEditing(null); setShowCreate(true); }} leftIcon={<Plus className="h-3.5 w-3.5" />}>New Worker</Button>
        </div>
      </header>

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">Test-user login uses a Credential Vault <span className="font-mono">secret_ref</span>. Only the reference reaches this UI; username/password values stay execution-only and are redacted from logs, reports, notifications, evidence, and Chief of Staff messages.</p>
        </CardContent>
      </Card>

      {(showCreate || editing) && (
        <WorkerForm
          worker={editing}
          projects={projects}
          secrets={secrets}
          onCancel={() => { setShowCreate(false); setEditing(null); }}
          onSaved={async () => { setShowCreate(false); setEditing(null); await load(false); }}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-xl border border-border bg-surface-muted/40" />)}</div>
      ) : workers.length === 0 ? (
        <Card><CardContent className="py-14 text-center"><p className="font-medium">No Browser Workers yet</p><p className="mt-2 text-sm text-muted-foreground">Create an on-demand or hourly/daily/weekly worker linked to a Project/App.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workers.map((worker) => (
            <Card key={worker.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{worker.name}</p>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{worker.project?.name || worker.projectId} · {worker.environment}</p>
                  </div>
                  <Badge variant={statusVariant(worker.status)} withDot>{worker.status}</Badge>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Info label="Schedule" value={scheduleLabel(worker.scheduleType)} />
                  <Info label="Last run" value={formatWorkerDate(worker.lastRunAt)} />
                  <Info label="Next run" value={worker.status === 'paused' ? 'Paused' : formatWorkerDate(worker.nextRunAt)} />
                  <Info label="Last result" value={worker.lastRun?.status || 'Never run'} />
                  <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-muted-foreground">Current action</dt><dd className="mt-1 line-clamp-2 text-sm">{worker.currentAction}</dd></div>
                  <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-muted-foreground">Target</dt><dd className="mt-1 truncate font-mono text-xs text-muted-foreground">{worker.targetUrl}</dd></div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button size="sm" onClick={() => void act(worker, 'run')} disabled={worker.status === 'running' || worker.status === 'paused' || busyId === worker.id} loading={busyId === worker.id} leftIcon={<Play className="h-3.5 w-3.5" />}>Run Now</Button>
                  {worker.status === 'paused' ? (
                    <Button size="sm" variant="outline" onClick={() => void act(worker, 'resume')} disabled={busyId === worker.id} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>Resume</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void act(worker, 'pause')} disabled={busyId === worker.id} leftIcon={<Pause className="h-3.5 w-3.5" />}>Pause</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setEditing(worker); }} disabled={worker.status === 'running'} leftIcon={<Edit3 className="h-3.5 w-3.5" />}>Edit</Button>
                  <Link href={`/sessions/${worker.id}`}><Button size="sm" variant="ghost" leftIcon={<History className="h-3.5 w-3.5" />}>View History</Button></Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkerForm({ worker, projects, secrets, onCancel, onSaved }: {
  worker: BrowserWorker | null;
  projects: BrowserWorkerProject[];
  secrets: VaultSecretSummary[];
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const initialProject = worker?.projectId || projects[0]?.id || '';
  const [projectId, setProjectId] = useState(initialProject);
  const [name, setName] = useState(worker?.name || '');
  const [environment, setEnvironment] = useState(worker?.environment || 'staging');
  const [targetUrl, setTargetUrl] = useState(worker?.targetUrl || '');
  const [scheduleType, setScheduleType] = useState<BrowserWorkerSchedule>(worker?.scheduleType || 'on_demand');
  const [secretRef, setSecretRef] = useState(worker?.credentialSecretRef || '');
  const [loginUrl, setLoginUrl] = useState(worker?.loginConfig?.loginUrl || '/login');
  const [usernameSelector, setUsernameSelector] = useState(worker?.loginConfig?.usernameSelector || '#email');
  const [passwordSelector, setPasswordSelector] = useState(worker?.loginConfig?.passwordSelector || '#password');
  const [submitSelector, setSubmitSelector] = useState(worker?.loginConfig?.submitSelector || 'button[type="submit"]');
  const [logoutSelector, setLogoutSelector] = useState(worker?.loginConfig?.logoutSelector || '#logout');
  const [workflowText, setWorkflowText] = useState(JSON.stringify(worker?.workflow || JSON.parse(defaultWorkflow), null, 2));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!worker && !targetUrl) {
      const project = projects.find((item) => item.id === projectId);
      if (project?.targetUrl) setTargetUrl(project.targetUrl);
    }
  }, [projectId, projects]);

  const selectedSecret = useMemo(() => secrets.find((secret) => secret.secretRef === secretRef), [secrets, secretRef]);

  const save = async () => {
    let workflow: BrowserWorkerWorkflowStep[];
    try {
      const parsed = JSON.parse(workflowText);
      if (!Array.isArray(parsed)) throw new Error('Workflow must be a JSON array');
      workflow = parsed;
    } catch (error) {
      toast.error('Invalid workflow JSON', { description: error instanceof Error ? error.message : 'Check the workflow JSON.' });
      return;
    }
    if (!worker && !projectId) { toast.error('Choose a Project/App'); return; }
    if (!name.trim()) { toast.error('Worker name is required'); return; }

    setSaving(true);
    try {
      const loginConfig = secretRef ? {
        loginUrl, usernameSelector, passwordSelector, submitSelector,
        ...(logoutSelector.trim() ? { logoutSelector } : {}),
      } : null;
      const payload = {
        name: name.trim(),
        environment: environment.trim(),
        targetUrl: targetUrl.trim() || undefined,
        scheduleType,
        credentialSecretRef: secretRef || null,
        loginConfig,
        workflow,
      };
      if (worker) await browserWorkersApi.updateWorker(worker.id, payload);
      else await browserWorkersApi.createWorker({ projectId, ...payload });
      toast.success(worker ? 'Browser Worker updated' : 'Browser Worker created');
      await onSaved();
    } catch (error) {
      toast.error('Failed to save Browser Worker', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">{worker ? 'Edit Browser Worker' : 'New Browser Worker'}</h2><p className="text-xs text-muted-foreground mt-1">Configuration is persisted by the backend. No credentials are entered here.</p></div><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button></div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Project / App"><select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={Boolean(worker)}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
          <Field label="Test environment"><Input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="staging" /></Field>
          <Field label="Worker name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Checkout Regression Worker" /></Field>
          <Field label="Target URL"><Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://staging.example.com" /></Field>
          <Field label="Schedule"><select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" value={scheduleType} onChange={(e) => setScheduleType(e.target.value as BrowserWorkerSchedule)}>{scheduleOptions.map((value) => <option key={value} value={value}>{scheduleLabel(value)}</option>)}</select></Field>
          <Field label="Credential Vault secret_ref (optional)"><select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" value={secretRef} onChange={(e) => setSecretRef(e.target.value)}><option value="">No login credential</option>{secrets.map((secret) => <option key={secret.secretRef} value={secret.secretRef}>{secret.secretRef}{secret.description ? ` — ${secret.description}` : ''}</option>)}</select>{secretRef && <p className="mt-1 text-[11px] text-muted-foreground">Selected metadata only: {selectedSecret?.secretRef}. Secret value is never returned.</p>}</Field>
        </div>

        {secretRef && <div className="grid gap-4 rounded-lg border border-border bg-surface-muted/30 p-4 md:grid-cols-2"><Field label="Login URL"><Input value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} /></Field><Field label="Username selector"><Input value={usernameSelector} onChange={(e) => setUsernameSelector(e.target.value)} /></Field><Field label="Password selector"><Input value={passwordSelector} onChange={(e) => setPasswordSelector(e.target.value)} /></Field><Field label="Login submit selector"><Input value={submitSelector} onChange={(e) => setSubmitSelector(e.target.value)} /></Field><Field label="Logout selector"><Input value={logoutSelector} onChange={(e) => setLogoutSelector(e.target.value)} /></Field></div>}

        <Field label="User workflow (JSON)"><Textarea rows={9} value={workflowText} onChange={(e) => setWorkflowText(e.target.value)} /><p className="mt-1 text-[11px] text-muted-foreground">Supported: login, navigate, click, fill, submit, wait, logout. Workflow values must contain test data only—never passwords or tokens.</p></Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={() => void save()} loading={saving}>{worker ? 'Save Changes' : 'Create Worker'}</Button></div>
      </CardContent>
    </Card>
  );
}

function WorkerHistory({ workerId }: { workerId: string }) {
  const [worker, setWorker] = useState<BrowserWorker | null>(null);
  const [history, setHistory] = useState<BrowserWorkerRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [workerRes, historyRes] = await Promise.all([browserWorkersApi.getWorker(workerId), browserWorkersApi.history(workerId)]);
      setWorker(workerRes.data); setHistory(historyRes.data || []);
    } catch (error) {
      toast.error('Failed to load worker history', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [workerId]);

  if (loading) return <div className="py-16 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading Browser Worker history...</div>;
  if (!worker) return <div className="py-16 text-center text-muted-foreground">Browser Worker not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3"><Link href="/sessions"><Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>Back to Browser Workers</Button></Link><Button variant="outline" size="sm" onClick={() => void load()} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button></div>
      <header className="border-b border-border pb-4"><div className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /><h1 className="text-2xl font-bold">{worker.name} History</h1><Badge variant={statusVariant(worker.status)}>{worker.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{worker.project?.name || worker.projectId} · {worker.environment} · {scheduleLabel(worker.scheduleType)}</p></header>
      <div className="grid gap-3 sm:grid-cols-4"><Summary label="Schedule" value={scheduleLabel(worker.scheduleType)} /><Summary label="Last run" value={formatWorkerDate(worker.lastRunAt)} /><Summary label="Next run" value={worker.status === 'paused' ? 'Paused' : formatWorkerDate(worker.nextRunAt)} /><Summary label="Current action" value={worker.currentAction} /></div>

      {history.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">No execution history yet.</CardContent></Card> : <div className="space-y-4">{history.map((run) => <RunReport key={run.id} run={run} />)}</div>}
    </div>
  );
}

function RunReport({ run }: { run: BrowserWorkerRun }) {
  const metrics = run.metrics;
  const comparison = run.comparison;
  const variant = run.status === 'passed' ? 'success' : run.status === 'running' ? 'info' : 'danger';
  return <Card><CardContent className="p-5 space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge variant={variant}>{run.status}</Badge><Badge variant="neutral">{run.trigger}</Badge>{comparison && <Badge variant={comparison.status === 'regressed' ? 'danger' : comparison.status === 'improved' ? 'success' : 'neutral'}>{comparison.status}</Badge>}</div><p className="mt-2 font-mono text-xs text-muted-foreground">{run.id}</p></div><div className="text-right text-xs text-muted-foreground"><p>{formatWorkerDate(run.startedAt)}</p><p>{formatWorkerDate(run.completedAt)}</p></div></div>{run.summary && <p className="text-sm">{run.summary}</p>}{metrics && <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Summary label="Functional" value={String(metrics.functionalFailures)} /><Summary label="Visual" value={String(metrics.visualDefects)} /><Summary label="Console" value={String(metrics.consoleErrors)} /><Summary label="Network" value={String(metrics.networkFailures)} /><Summary label="Total" value={String(metrics.totalFailures)} /></div>}{comparison?.baselineRunId && <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-4 w-4" />Compared with previous run <span className="font-mono">{comparison.baselineRunId}</span>; failure delta {comparison.deltas.totalFailures >= 0 ? '+' : ''}{comparison.deltas.totalFailures}.</div>}</CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>; }
function Summary({ label, value }: { label: string; value: string }) { return <Card className="p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p></Card>; }
