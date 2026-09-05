import React, { useEffect, useMemo, useState } from 'react';
import { api, type ApiIssue, type ApiRun } from '@/lib/api';
import { Link } from '@/lib/router';
import { Badge, Button, Card } from '@/components/ui';
import { Activity, AlertTriangle, CheckCircle2, Loader2, PlayCircle, XCircle } from 'lucide-react';
import { AutomationStatusCard } from '@/components/dashboard';

export default function DashboardPage() {
  const [runs,setRuns]=useState<ApiRun[]>([]); const [issues,setIssues]=useState<ApiIssue[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{Promise.all([api.listRuns(),api.listIssues()]).then(([r,i])=>{setRuns(r.data);setIssues(i.data);}).catch(e=>setError(e instanceof Error?e.message:'Failed to load dashboard')).finally(()=>setLoading(false));},[]);
  const metrics=useMemo(()=>({total:runs.length,running:runs.filter(r=>r.status==='running').length,passed:runs.filter(r=>r.status==='passed'||r.status==='completed').length,failed:runs.filter(r=>['failed','error','aborted'].includes(r.status)).length,open:issues.filter(i=>i.status==='open').length}),[runs,issues]);
  if(loading)return <div className="py-16 flex justify-center gap-2 text-muted-foreground"><Loader2 className="animate-spin"/>Loading dashboard...</div>;
  if(error)return <div className="py-16 text-center text-rose-500">{error}</div>;
  return <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-150">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-4"><div><p className="text-xs uppercase font-mono text-muted-foreground">AgentOps Control Center</p><h1 className="text-2xl font-bold mt-1">Dashboard</h1><p className="text-sm text-muted-foreground mt-1">Real Phase-1 run and issue data from the backend.</p></div><Link href="/command"><Button size="sm">Start QA Run</Button></Link></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"><Metric label="Total Runs" value={metrics.total} icon={<PlayCircle/>}/><Metric label="Running" value={metrics.running} icon={<Activity/>}/><Metric label="Passed" value={metrics.passed} icon={<CheckCircle2/>}/><Metric label="Failed" value={metrics.failed} icon={<XCircle/>}/><Metric label="Open Issues" value={metrics.open} icon={<AlertTriangle/>}/></div>
    <AutomationStatusCard/>
    <div className="grid lg:grid-cols-3 gap-6"><Card className="lg:col-span-2 p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Recent Runs</h2><Link href="/runs" className="text-xs text-primary">View all</Link></div>{runs.length===0?<p className="text-sm text-muted-foreground py-8 text-center">No runs yet.</p>:<div className="space-y-2">{runs.slice(0,6).map(r=><Link href={`/runs/${r.id}`} key={r.id} className="flex items-center justify-between gap-3 border border-border rounded-lg p-3 hover:border-primary/30"><div className="min-w-0"><p className="font-mono text-xs truncate">{r.id}</p><p className="text-xs text-muted-foreground mt-1">{formatDate(r.startedAt || r.createdAt)}</p></div><Badge variant={r.status==='passed'||r.status==='completed'?'success':r.status==='running'?'info':['failed','error','aborted'].includes(r.status)?'danger':'neutral'}>{r.status}</Badge></Link>)}</div>}</Card><Card className="p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Open Issues</h2><Link href="/issues" className="text-xs text-primary">View all</Link></div>{issues.filter(i=>i.status==='open').length===0?<p className="text-sm text-muted-foreground py-8 text-center">No open issues.</p>:<div className="space-y-2">{issues.filter(i=>i.status==='open').slice(0,5).map(i=><Link href={`/issues/${i.id}`} key={i.id} className="block border border-border rounded-lg p-3 hover:border-primary/30"><div className="flex justify-between gap-2"><p className="text-sm font-medium line-clamp-2">{i.title}</p><Badge variant={i.severity==='critical'?'danger':i.severity==='high'?'warning':i.severity==='medium'?'info':'neutral'}>{i.severity}</Badge></div></Link>)}</div>}</Card></div>
  </div>;
}
function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'Just now';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'Just now' : d.toLocaleString();
}
function Metric({label,value,icon}:{label:string;value:number;icon:React.ReactNode}){return <Card className="p-4"><div className="w-4 h-4 text-muted-foreground">{icon}</div><p className="text-2xl font-bold font-mono mt-3">{value}</p><p className="text-xs text-muted-foreground mt-1">{label}</p></Card>}
