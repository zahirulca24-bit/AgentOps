import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from '@/components/ui';
import { Link } from '@/lib/router';
import { IssueSummaryData, IssueSeverity } from '@/types';
import { ArrowUpRight, AlertTriangle, ShieldAlert, AlertCircle, Info } from 'lucide-react';

export interface IssueSummaryCardProps {
  issueSummary: IssueSummaryData;
}

export function IssueSummaryCard({ issueSummary }: IssueSummaryCardProps) {
  const getSeverityBadge = (sev: IssueSeverity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            Critical
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            High
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            Medium
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-medium bg-surface-muted text-muted-foreground border border-border">
            Low
          </span>
        );
    }
  };

  return (
    <Card className="border-border bg-surface flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Issue Summary
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Active defects and regressions identified by agent assertions
            </CardDescription>
          </div>

          <Link href="/issues" className="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary hover:text-primary"
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              Open Issues ({issueSummary.totalOpen})
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Severity Counters Grid */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Critical */}
            <div className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5">
              <span className="text-[10px] font-mono uppercase text-rose-600 dark:text-rose-400 font-semibold block">
                Critical
              </span>
              <span className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">
                {issueSummary.critical}
              </span>
            </div>

            {/* High */}
            <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <span className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 font-semibold block">
                High
              </span>
              <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5 block">
                {issueSummary.high}
              </span>
            </div>

            {/* Medium */}
            <div className="p-2.5 rounded-lg border border-sky-500/20 bg-sky-500/5">
              <span className="text-[10px] font-mono uppercase text-sky-600 dark:text-sky-400 font-semibold block">
                Medium
              </span>
              <span className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400 mt-0.5 block">
                {issueSummary.medium}
              </span>
            </div>

            {/* Low */}
            <div className="p-2.5 rounded-lg border border-border bg-surface-muted">
              <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold block">
                Low
              </span>
              <span className="text-lg font-bold font-mono text-muted-foreground mt-0.5 block">
                {issueSummary.low}
              </span>
            </div>
          </div>

          {/* Recent Open Issues List */}
          {issueSummary.recentIssues.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Zero active issues. All test assertions passed.
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                Top Priority Triage:
              </span>
              <ul className="space-y-2" aria-label="Recent high priority issues">
                {issueSummary.recentIssues.slice(0, 3).map((issue) => (
                  <li
                    key={issue.id}
                    className="p-2.5 rounded-md border border-border bg-surface-muted/50 hover:bg-surface-muted transition-colors flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(issue.severity)}
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {issue.runId}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground leading-snug line-clamp-1" title={issue.title}>
                        {issue.title}
                      </p>
                      <span className="text-[11px] font-mono text-muted-foreground truncate block">
                        {issue.targetUrl} • {issue.timeAgo}
                      </span>
                    </div>

                    <Link href="/issues" className="shrink-0 pt-0.5">
                      <span className="text-[11px] text-primary hover:underline font-medium">
                        Triage
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </div>

      <div className="p-4 border-t border-border/70 bg-surface-muted/30">
        <Link href="/issues" className="w-full">
          <Button variant="outline" size="sm" className="w-full text-xs">
            Review All Defects &amp; Failures
          </Button>
        </Link>
      </div>
    </Card>
  );
}
