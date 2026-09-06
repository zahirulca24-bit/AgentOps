import React from 'react';
import { Badge, Button } from '@/components/ui';
import { Clock, PlayCircle, Radio, FlaskConical, ChevronDown, Loader2 } from 'lucide-react';
import { Link } from '@/lib/router';
import { ApiRun } from '@/lib/api';

interface AutomationHeaderProps {
  activeRun: ApiRun | null;
  allRuns: ApiRun[];
  onSelectRun: (runId: string) => void;
  isConnected?: boolean;
}

export function AutomationHeader({ activeRun, allRuns, onSelectRun, isConnected }: AutomationHeaderProps) {
  const isRunning = activeRun?.status === 'running' || activeRun?.status === 'pending';

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border bg-background pt-1">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <FlaskConical className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            AI Automation Pipeline
          </h1>
          {activeRun && (
            <Badge
              variant={
                isRunning
                  ? 'info'
                  : activeRun.status === 'passed' || activeRun.status === 'completed'
                  ? 'success'
                  : 'danger'
              }
              size="sm"
              withDot
              dotClassName={isRunning ? 'animate-pulse' : ''}
            >
              {activeRun.status}
            </Badge>
          )}
          {isConnected && isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-mono font-medium animate-pulse">
              <Radio className="w-3.5 h-3.5" /> Live Stream Connected
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
          Real-time autonomous QA pipeline steps: Plan → Explore → Generate Tests → Execute → Evidence → Issues → Report.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {allRuns.length > 0 && (
          <div className="relative">
            <select
              value={activeRun?.id || ''}
              onChange={(e) => onSelectRun(e.target.value)}
              className="h-9 px-3 py-1.5 pr-8 rounded-lg border border-border bg-surface text-xs font-mono font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
            >
              <option value="" disabled>
                Select a Test Run...
              </option>
              {allRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.slice(0, 8)}... ({r.status}) - {new Date(r.startedAt).toLocaleTimeString()}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        <Link href="/command">
          <Button size="sm" leftIcon={<PlayCircle className="w-4 h-4" />}>
            New Command
          </Button>
        </Link>
      </div>
    </div>
  );
}
