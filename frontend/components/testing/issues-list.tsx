import React, { useState } from 'react';
import { MOCK_ISSUES, IssueStatus, IssueSeverity } from '@/lib/mock-testing';
import { Badge, Input } from '@/components/ui';
import { AlertCircle, Search, Bug, CheckCircle2, CircleDashed, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/router';

export function IssuesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredIssues = MOCK_ISSUES.filter(issue => {
    if (filterStatus !== 'all' && issue.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return issue.title.toLowerCase().includes(q) || issue.id.toLowerCase().includes(q);
    }
    return true;
  });

  const getSeverityBadge = (severity: IssueSeverity) => {
    switch (severity) {
      case 'critical': return <Badge variant="danger" size="sm" className="uppercase text-[10px]">Critical</Badge>;
      case 'high': return <Badge variant="warning" size="sm" className="uppercase text-[10px]">High</Badge>;
      case 'medium': return <Badge variant="info" size="sm" className="uppercase text-[10px]">Medium</Badge>;
      case 'low': return <Badge variant="neutral" size="sm" className="uppercase text-[10px]">Low</Badge>;
      default: return null;
    }
  };

  const getStatusIcon = (status: IssueStatus) => {
    switch (status) {
      case 'open': return <CircleDashed className="w-4 h-4 text-rose-500" />;
      case 'investigating': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'fixed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'closed': return <CheckCircle2 className="w-4 h-4 text-zinc-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-xs shrink-0">
              <Bug className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Issues
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Autonomous bug detection, triage, and regression tracking.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'open', 'investigating', 'fixed', 'closed'].map(status => (
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
            placeholder="Search issues..."
            className="h-9 text-xs font-mono"
            leftIcon={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Grid of Issues */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredIssues.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            No issues matched your criteria.
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              aria-label={`View issue ${issue.id}`}
              className="p-4 rounded-xl border border-border bg-surface shadow-2xs hover:shadow-sm hover:border-primary/30 transition-all flex flex-col space-y-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(issue.status)}
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{issue.id}</span>
                </div>
                {getSeverityBadge(issue.severity)}
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 group-hover:text-primary transition-colors">
                  {issue.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {issue.description}
                </p>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>Discovered: {issue.discoveredAt}</span>
                <span className="flex items-center gap-1 text-primary">Details <ArrowRight className="w-3 h-3" /></span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
