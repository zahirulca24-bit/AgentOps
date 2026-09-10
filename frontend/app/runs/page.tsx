import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, Link } from '@/lib/router';
import { api, type ApiRun } from '@/lib/api';
import { buildIssueContexts, groupRootIssues } from '@/lib/issue-groups';
import { Badge, Button, Card, Input } from '@/components/ui';
import { ArrowLeft, AlertCircle, CheckCircle2, XCircle, Clock3, Search, FlaskConical, Loader2, StopCircle, ImageIcon, Bug } from 'lucide-react';
import { toast } from 'sonner';

const variant = (status: ApiRun['status']) => status === 'passed' || status === 'completed' ? 'success' : status === 'failed' || status === 'error' || status === 'aborted' || status === 'stopped' ? 'danger' : status === 'running' ? 'info' : 'neutral';
const elapsed = (run: ApiRun) => {
  const start = new Date(run.startedAt).getTime();
  const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export default function TestRunsPage() {
  const id = usePathname().split('/').filter(Boolean)[1];
  return id ? <RunDetail id={id} /> : <RunList />;
}

function RunList() {
  const [runs, setRuns] = useState<ApiRun[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { 
    api.listRuns()
      .then(r => setRuns(r.data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load runs'))
      .finally(() => setLoading(false)); 
  }, []);

  const filtered = useMemo(() => runs.filter(r => !query.trim() || r.id.toLowerCase().includes(query.toLowerCase()) || r.status.includes(query.toLowerCase()) || r.task?.project?.name?.toLowerCase().includes(query.toLowerCase())), [runs, query]);

  return <div className="space-y-6 animate-in fade-in duration-150">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
      <div><div className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-primary"/><h1 className="text-2xl font-bold">Test Runs</h1></div><p className="text-sm text-muted-foreground mt-1">Live data from the AgentOps backend.</p></div>
      <Link href="/command"><Button size="sm">New Run</Button></Link>
    </div>
    <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search runs..." leftIcon={<Search className="w-4 h-4"/>}/>
    {loading ? <State icon={<Loader2 className="animate-spin"/>} text="Loading runs..."/> : error ? <State icon={<AlertCircle/>} text={error}/> : filtered.length === 0 ? <State text="No runs yet."/> :
      <div className="border border-border rounded-xl overflow-x-auto bg-surface"><table className="w-full text-sm"><thead><tr className="bg-surface-muted text-left text-xs text-muted-foreground"><th className="p-3">Run</th><th className="p-3">Project / Target</th><th className="p-3">Status</th><th className="p-3">Started</th><th className="p-3">Duration</th><th className="p-3"></th></tr></thead><tbody>{filtered.map(run => <tr key={run.id} className="border-t border-border"><td className="p-3 font-mono text-xs">{run.id}</td><td className="p-3 text-xs"><div className="font-medium">{run.task?.project?.name || 'Project unavailable'}</div><div className="text-muted-foreground truncate max-w-xs">{run.task?.targetUrl || run.task?.project?.targetUrl || 'Target URL unavailable'}</div></td><td className="p-3"><Badge variant={variant(run.status)}>{run.status}</Badge></td><td className="p-3 text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</td><td className="p-3 font-mono text-xs">{elapsed(run)}</td><td className="p-3 text-right"><Link href={`/runs/${run.id}`}><Button variant="ghost" size="sm">Details</Button></Link></td></tr>)}</tbody></table></div>}
  </div>;
}

function RunDetail({ id }: { id: string }) {
  const [run, setRun] = useState<ApiRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchRunDetails = () => {
    api.getRun(id)
      .then(r => setRun(r.data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load run'));
  };

  useEffect(() => {
    fetchRunDetails();
  }, [id]);

  useEffect(() => {
    if (!run || (run.status !== 'running' && run.status !== 'pending')) return;

    const eventSource = new EventSource(`${api.baseUrl}/api/v1/runs/${id}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'run_completed' || data.event === 'run_cancelled' || data.event === 'test_completed' || data.event === 'issue_created') {
          fetchRunDetails();
        }
      } catch {}
    };

    eventSource.addEventListener('test_completed', () => fetchRunDetails());
    eventSource.addEventListener('run_completed', () => fetchRunDetails());
    eventSource.addEventListener('run_cancelled', () => fetchRunDetails());
    eventSource.addEventListener('issue_created', () => fetchRunDetails());

    const interval = setInterval(fetchRunDetails, 3000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [id, run?.status]);

  const handleCancelRun = async () => {
    setCancelling(true);
    try {
      await api.cancelRun(id);
      toast.success('Run cancellation requested');
      fetchRunDetails();
    } catch (err) {
      toast.error('Failed to cancel run', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setCancelling(false);
    }
  };

  if (error) return <MissingRecord message={error}/>;
  if (!run) return <State icon={<Loader2 className="animate-spin"/>} text="Loading run..."/>;

  const passed = run.testResults?.filter(t => t.status === 'passed').length ?? 0;
  const failed = run.testResults?.filter(t => ['failed','error'].includes(t.status)).length ?? 0;
  const rootIssues = groupRootIssues(run.issues || [], buildIssueContexts([run]));
  const activeWorkers = run.browserSessions?.filter(session => session.status === 'active').length || 0;
  const isRunning = run.status === 'running' || run.status === 'pending';

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <Link href="/runs"><Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4"/>}>Back to Runs</Button></Link>
      {isRunning && (
        <Button 
          variant="outline" 
          size="sm" 
          disabled={cancelling} 
          onClick={handleCancelRun}
          leftIcon={cancelling ? <Loader2 className="w-4 h-4 animate-spin"/> : <StopCircle className="w-4 h-4 text-red-500"/>}
        >
          {cancelling ? 'Cancelling...' : 'Cancel Run'}
        </Button>
      )}
    </div>

    <div>
      <div className="flex gap-2 items-center flex-wrap">
        <h1 className="text-2xl font-bold">Run</h1>
        <Badge variant={variant(run.status)}>{run.status}</Badge>
        {isRunning && <span className="flex items-center gap-1.5 text-xs text-blue-500 font-medium animate-pulse"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Streaming Live Events</span>}
      </div>
      <p className="font-mono text-xs text-muted-foreground mt-1">{run.id}</p>
      <p className="text-xs text-muted-foreground mt-1">{run.task?.project?.name || 'Project unavailable'} · {run.task?.targetUrl || run.task?.project?.targetUrl || 'Target URL unavailable'} · {activeWorkers} active worker{activeWorkers===1?'':'s'}</p>
    </div>

    <Card className="p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Metric label="Passed" value={String(passed)} icon={<CheckCircle2 className="w-4 h-4 text-emerald-500"/>}/>
      <Metric label="Failed" value={String(failed)} icon={<XCircle className="w-4 h-4 text-red-500"/>}/>
      <Metric label="Root Issues" value={String(rootIssues.length)} icon={<Bug className="w-4 h-4 text-amber-500"/>}/>
      <Metric label="Duration" value={elapsed(run)} icon={<Clock3 className="w-4 h-4"/>}/>
    </Card>

    <Card className="p-5 space-y-4">
      <h2 className="font-semibold text-lg">Test Results</h2>
      {!run.testResults?.length ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {isRunning ? 'Executing test suite in background...' : 'No test results recorded.'}
        </p>
      ) : (
        <div className="space-y-3">
          {run.testResults.map(t => (
            <div key={t.id} className="border border-border rounded-xl p-4 space-y-3 bg-surface hover:border-border/80 transition-colors">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.summary || t.errorMessage || 'No summary'}</p>
                </div>
                <Badge variant={t.status === 'passed' ? 'success' : ['failed','error'].includes(t.status) ? 'danger' : 'neutral'}>
                  {t.status}
                </Badge>
              </div>

              {t.screenshotRef && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <ImageIcon className="w-3.5 h-3.5"/> Screenshot Evidence
                  </div>
                  <div className="relative overflow-hidden rounded-lg border border-border bg-black/40 max-w-md">
                    <img 
                      src={`${api.baseUrl}/api/v1/evidence/${t.screenshotRef}`} 
                      alt={`Evidence for ${t.name}`}
                      className="w-full object-cover max-h-56 hover:scale-105 transition-transform duration-200"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>

    {rootIssues.length > 0 && (
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Bug className="w-5 h-5 text-amber-500"/> Detected Root Issues ({rootIssues.length})
        </h2>
        <div className="space-y-2">
          {rootIssues.map(root => {
            const issue = root.issues[0];
            return (
              <div key={root.key} className="flex items-start justify-between gap-3 border border-border rounded-lg p-3 bg-surface">
                <div>
                  <p className="text-sm font-medium">{root.rootCause}</p>
                  <p className="text-xs text-muted-foreground mt-1">{root.failedTests} failed test symptom{root.failedTests===1?'':'s'} · {issue.description || 'No description provided'}</p>
                </div>
                <Badge variant={issue.severity === 'critical' || issue.severity === 'high' ? 'danger' : 'warning'}>
                  {issue.severity}
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>
    )}
  </div>;
}

function Metric({label,value,icon}:{label:string;value:string;icon?:React.ReactNode}) { return <div><div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div><p className="font-semibold text-lg mt-1">{value}</p></div>; }
function State({text,icon}:{text:string;icon?:React.ReactNode}) { return <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">{icon}{text}</div>; }
function MissingRecord({message}:{message:string}) { return <div className="py-12 text-center space-y-4"><AlertCircle className="w-8 h-8 mx-auto text-muted-foreground"/><p>{message}</p><Link href="/runs"><Button variant="outline" size="sm">Return to Runs</Button></Link></div>; }
