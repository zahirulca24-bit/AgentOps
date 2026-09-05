import React from 'react';
import { AutomationWorkflow } from '@/types';
import { Badge } from '@/components/ui';
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface AutomationHeaderProps {
  workflow: AutomationWorkflow;
}

export function AutomationHeader({ workflow }: AutomationHeaderProps) {
  const isRunning = workflow.status === 'running';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border bg-background pt-1">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {workflow.name}
          </h1>
          <Badge 
            variant={isRunning ? 'info' : workflow.status === 'success' ? 'success' : 'neutral'} 
            size="sm"
            withDot
            dotClassName={isRunning ? 'motion-safe:animate-pulse' : ''}
          >
            {workflow.status}
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
          {workflow.description}
        </p>
      </div>

      <div className="flex items-center gap-4 bg-surface px-4 py-2 rounded-lg border border-border shadow-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Run ID</span>
          <span className="text-xs font-mono font-bold text-foreground">{workflow.id}</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Started</span>
          <span className="text-xs font-medium text-foreground">{workflow.startedAt || '-'}</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-foreground">{workflow.elapsedTime || '00:00:00'}</span>
        </div>
      </div>
    </div>
  );
}
