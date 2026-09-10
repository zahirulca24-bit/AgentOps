import React from 'react';
import type { ApiRun } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, Button, StatusIndicator } from '@/components/ui';
import { Link } from '@/lib/router';
import { Workflow, ArrowRight } from 'lucide-react';

export function AutomationStatusCard({ activeRun, activeWorkers }: { activeRun?: ApiRun | null; activeWorkers: number }) {
  const running = Boolean(activeRun);
  const projectName = activeRun?.task?.project?.name;
  const targetUrl = activeRun?.task?.targetUrl || activeRun?.task?.project?.targetUrl;
  const context = projectName || targetUrl || (activeRun ? `Run ${activeRun.id.slice(0, 8)}` : 'No active QA run');

  return (
    <Card className="border-border bg-surface shadow-xs">
      <CardHeader className="pb-3 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Workflow className="w-5 h-5 text-primary" />
          <CardTitle className="text-base font-semibold text-foreground">
            AI Automation Pipelines
          </CardTitle>
        </div>
        <Link href="/automation">
          <Button variant="outline" size="sm" className="text-xs" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
            Open Builder
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border border-primary/20 bg-primary/10 flex items-center justify-center">
            <StatusIndicator status={running ? 'running' : 'idle'} showPulse={running} className="[&>span:last-child]:hidden" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Standard QA Execution Pipeline</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {running ? <>Active backend run: <span className="font-mono text-primary">{context}</span></> : 'No backend run is currently executing.'}
            </p>
          </div>
        </div>
        <div className="text-right flex flex-col gap-1 items-end">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Active Workers</span>
          <span className="text-lg font-bold text-foreground">{activeWorkers}</span>
        </div>
      </CardContent>
    </Card>
  );
}
