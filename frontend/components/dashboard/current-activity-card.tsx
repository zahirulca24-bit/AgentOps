import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, StatusIndicator, Button } from '@/components/ui';
import { Link } from '@/lib/router';
import { ActiveRunActivity } from '@/types';
import { Globe, ArrowRight, Cpu, Clock, Layers } from 'lucide-react';

export interface CurrentActivityCardProps {
  activity: ActiveRunActivity | null;
}

export function CurrentActivityCard({ activity }: CurrentActivityCardProps) {
  if (!activity) {
    return (
      <Card className="border-dashed border-border bg-surface/40">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-surface-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                No Active Executions
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Agent workers are idle and standing by for the next test suite or command prompt.
              </p>
            </div>
          </div>
          <Link href="/command">
            <Button variant="outline" size="sm" className="text-xs shrink-0">
              Dispatch Prompt
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-surface shadow-xs">
      <CardHeader className="pb-3 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <StatusIndicator status="running" showPulse={true} />
          <CardTitle className="text-base font-semibold text-foreground">
            Current Autonomous Activity
          </CardTitle>
          <Badge variant="info" size="sm" withDot dotClassName="motion-safe:animate-pulse">
            Live Execution
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Elapsed: {activity.elapsedTime}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" />
            {activity.activeWorkers} Workers
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Run Title + Target Link */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-muted border border-border text-foreground font-semibold">
                {activity.runNumber}
              </span>
              <h4 className="text-sm sm:text-base font-semibold text-foreground">
                {activity.name}
              </h4>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
              <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-[11px] truncate max-w-md">
                {activity.targetUrl}
              </span>
            </div>
          </div>

          <Link href="/runs" className="shrink-0 self-start">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Inspect Run
            </Button>
          </Link>
        </div>

        {/* Progress Bar & Current Stage */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
              <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{activity.stage}</span>
            </div>
            <span className="font-mono font-semibold text-primary shrink-0 ml-2">
              {activity.progressPercent}%
            </span>
          </div>

          {/* Progress Bar track */}
          <div
            className="w-full h-2 rounded-full bg-surface-muted border border-border overflow-hidden"
            role="progressbar"
            aria-valuenow={activity.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Current run progress"
          >
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${activity.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Current Execution Step Trace */}
        {activity.currentStep && (
          <div className="p-2.5 rounded-md bg-surface-muted border border-border/80 text-xs font-mono flex items-start gap-2 text-muted-foreground">
            <span className="text-primary font-semibold shrink-0">EXEC:</span>
            <span className="text-foreground truncate">{activity.currentStep}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
