import React from 'react';
import { Link } from '@/lib/router';
import { Button, Card, Badge } from '@/components/ui';
import { PlayCircle, ArrowRight, Bot, Activity, Clock, FlaskConical } from 'lucide-react';
import { ApiRun } from '@/lib/api';

interface AutomationEmptyStateProps {
  recentRuns?: ApiRun[];
  onSelectRun?: (runId: string) => void;
}

export function AutomationEmptyState({ recentRuns = [], onSelectRun }: AutomationEmptyStateProps) {
  return (
    <Card className="p-8 text-center space-y-6 max-w-3xl mx-auto my-8 border-dashed border-2">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
        <Bot className="w-8 h-8 animate-pulse" />
      </div>

      <div className="space-y-2 max-w-md mx-auto">
        <h2 className="text-xl font-bold tracking-tight text-foreground">No Active Automation Pipeline</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Dispatch a new AI QA command or select a previous run to visualize real-time pipeline execution steps.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/command">
          <Button size="md" leftIcon={<PlayCircle className="w-4 h-4" />}>
            Dispatch New Command
          </Button>
        </Link>
        <Link href="/runs">
          <Button variant="outline" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
            View All Test Runs
          </Button>
        </Link>
      </div>

      {recentRuns.length > 0 && (
        <div className="pt-6 border-t border-border space-y-3 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> Recent Runs Available to Inspect
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {recentRuns.slice(0, 4).map((run) => (
              <button
                key={run.id}
                onClick={() => onSelectRun?.(run.id)}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-surface-muted/50 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FlaskConical className="w-4 h-4 text-primary shrink-0" />
                  <div className="truncate">
                    <p className="font-mono text-xs font-semibold text-foreground truncate">{run.id}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</p>
                  </div>
                </div>
                <Badge
                  variant={
                    run.status === 'passed' || run.status === 'completed'
                      ? 'success'
                      : run.status === 'failed' || run.status === 'error'
                      ? 'danger'
                      : 'info'
                  }
                  size="sm"
                >
                  {run.status}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
