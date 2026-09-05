import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  StatusIndicator,
  Button,
} from '@/components/ui';
import { Link } from '@/lib/router';
import { RecentRun } from '@/types';
import { ArrowUpRight, Globe, Layers, AlertCircle } from 'lucide-react';

export interface RecentRunsTableProps {
  runs: RecentRun[];
}

export function RecentRunsTable({ runs }: RecentRunsTableProps) {
  const getStatusBadge = (status: RecentRun['status']) => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="info" size="sm" withDot dotClassName="motion-safe:animate-pulse">
            Running
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="success" size="sm" withDot>
            Passed
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="danger" size="sm" withDot>
            Failed
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="warning" size="sm" withDot>
            Warning
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            Queued
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Recent QA Runs
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Automated test suite executions across staging and production targets
          </CardDescription>
        </div>

        <Link href="/runs" className="self-start sm:self-center shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-primary hover:text-primary"
            rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
          >
            View all runs
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {runs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No recent test executions recorded. Start your first QA run from the Command Center.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  <th scope="col" className="py-2.5 px-4 font-medium">Run</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Target</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Status</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Tests</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Issues</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Started</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Duration</th>
                  <th scope="col" className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="group hover:bg-surface-muted/40 transition-colors"
                  >
                    {/* Run # and Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground text-xs">
                          {run.runNumber}
                        </span>
                        <span className="font-medium text-foreground truncate max-w-[180px] sm:max-w-xs block" title={run.name}>
                          {run.name}
                        </span>
                      </div>
                    </td>

                    {/* Target Website */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px] truncate max-w-[160px]" title={run.targetUrl}>
                        <Globe className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{run.targetUrl.replace(/^https?:\/\//, '')}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {getStatusBadge(run.status)}
                    </td>

                    {/* Tests Passed / Total */}
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className={run.passedTests === run.totalTests ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-foreground'}>
                        {run.passedTests}
                      </span>
                      <span className="text-muted-foreground">/{run.totalTests}</span>
                    </td>

                    {/* Issues Found */}
                    <td className="py-3 px-4">
                      {run.issuesCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <AlertCircle className="w-3 h-3" />
                          {run.issuesCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono text-[11px]">0</span>
                      )}
                    </td>

                    {/* Started */}
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                      {run.startedAt}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                      {run.duration}
                    </td>

                    {/* Action button leading to /runs */}
                    <td className="py-3 px-4 text-right">
                      <Link href="/runs">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground group-hover:text-foreground"
                          aria-label={`View run ${run.runNumber} details`}
                        >
                          <span className="text-[11px]">Inspect</span>
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
