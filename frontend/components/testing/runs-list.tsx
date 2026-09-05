import React, { useState } from 'react';
import { MOCK_RUNS, TestRun, RunStatus } from '@/lib/mock-testing';
import { Badge, Button, Input } from '@/components/ui';
import { FlaskConical, Search, Play, CheckCircle2, XCircle, Clock, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/router';

export function RunsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredRuns = MOCK_RUNS.filter(run => {
    if (filterStatus !== 'all' && run.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return run.suiteName.toLowerCase().includes(q) || run.id.toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusBadge = (status: RunStatus) => {
    switch (status) {
      case 'passed': return <Badge variant="success" size="sm" withDot>Passed</Badge>;
      case 'failed': return <Badge variant="danger" size="sm" withDot>Failed</Badge>;
      case 'running': return <Badge variant="info" size="sm" withDot>Running</Badge>;
      case 'queued': return <Badge variant="neutral" size="sm" withDot>Queued</Badge>;
      default: return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const getPassRate = (run: TestRun) => {
    const total = run.passCount + run.failCount + run.skipCount;
    if (total === 0) return 0;
    return Math.round((run.passCount / total) * 100);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
              <FlaskConical className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Test Runs
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Automated test execution suites, traces, and step assertions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button variant="primary" size="sm" className="text-xs h-9 shadow-xs" leftIcon={<Play className="w-4 h-4" />}>
            Execute Suite
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-border bg-surface shadow-2xs space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">Total Runs</span>
          <div className="text-xl font-bold font-mono text-foreground">{MOCK_RUNS.length}</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-surface shadow-2xs space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">Passed</span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {MOCK_RUNS.filter(r => r.status === 'passed').length}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-surface shadow-2xs space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">Failed</span>
          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {MOCK_RUNS.filter(r => r.status === 'failed').length}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-surface shadow-2xs space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">Avg Duration</span>
          <div className="text-xl font-bold font-mono text-foreground">3m 12s</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'passed', 'failed', 'running'].map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 capitalize',
                filterStatus === status
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'bg-surface-muted text-muted-foreground hover:text-foreground border border-border/70'
              )}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runs..."
            className="h-9 text-xs font-mono"
            leftIcon={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl bg-surface overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-[11px] font-mono text-muted-foreground uppercase font-semibold">
                <th className="py-3 px-4">Run ID / Suite</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Pass Rate</th>
                <th className="py-3 px-4">Tests</th>
                <th className="py-3 px-4">Environment</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No runs matched your criteria.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-surface-muted/40 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-foreground text-sm">
                          {run.suiteName}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {run.id} • {run.startedAt}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(run.status)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full", run.status === 'failed' ? "bg-rose-500" : run.status === 'running' ? "bg-sky-500" : "bg-emerald-500")} 
                            style={{ width: `${getPassRate(run)}%` }} 
                          />
                        </div>
                        <span className="font-mono text-[11px]">{getPassRate(run)}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> {run.passCount}</span>
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5"><XCircle className="w-3 h-3" /> {run.failCount}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-0.5">
                        <span className="text-foreground">{run.targetEnvironment}</span>
                        <span className="text-muted-foreground text-[10px] font-mono">{run.browser}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {run.status === 'running' ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {run.duration}</span>
                      ) : (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {run.duration}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link href={`/runs/${run.id}`} aria-label={`View details for ${run.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs text-primary group-hover:translate-x-0.5 transition-transform"
                          rightIcon={<ArrowRight className="w-3 h-3" />}
                        >
                          Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
