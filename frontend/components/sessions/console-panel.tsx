import React, { useState } from 'react';
import { ConsoleEvent } from '@/types';
import { Terminal, AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';

export interface ConsolePanelProps {
  logs: ConsoleEvent[];
  className?: string;
}

export function ConsolePanel({ logs, className }: ConsolePanelProps) {
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [expandedStacks, setExpandedStacks] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleStack = (id: string) => {
    setExpandedStacks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warning').length;

  const filteredLogs = logs.filter((l) => {
    if (filterLevel === 'all') return true;
    return l.level === filterLevel;
  });

  return (
    <div className={cn('space-y-3 font-mono text-xs', className)}>
      {/* Top filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border text-[11px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterLevel('all')}
            className={cn(
              'px-2 py-0.5 rounded transition-colors',
              filterLevel === 'all'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-surface-muted text-muted-foreground hover:text-foreground'
            )}
          >
            All ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterLevel('error')}
            className={cn(
              'px-2 py-0.5 rounded flex items-center gap-1 transition-colors',
              filterLevel === 'error'
                ? 'bg-rose-600 text-white font-semibold'
                : 'bg-surface-muted text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
            )}
          >
            <AlertCircle className="w-3 h-3" />
            <span>Errors ({errorCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterLevel('warning')}
            className={cn(
              'px-2 py-0.5 rounded flex items-center gap-1 transition-colors',
              filterLevel === 'warning'
                ? 'bg-amber-600 text-white font-semibold'
                : 'bg-surface-muted text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Warnings ({warnCount})</span>
          </button>
        </div>

        <span className="text-[10px] text-muted-foreground">
          Browser Console Telemetry
        </span>
      </div>

      {/* Log items feed */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg">
            No console output recorded for this filter.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isError = log.level === 'error';
            const isWarn = log.level === 'warning';
            const isExpanded = Boolean(expandedStacks[log.id]);

            return (
              <div
                key={log.id}
                className={cn(
                  'rounded-lg border p-2.5 transition-colors',
                  isError
                    ? 'border-rose-500/30 bg-rose-500/5 text-rose-950 dark:text-rose-200'
                    : isWarn
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-200'
                    : 'border-border bg-surface-muted/40 text-foreground'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="mt-0.5 shrink-0">
                      {isError ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-sky-500" />
                      )}
                    </span>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{log.timestamp}</span>
                        <span>•</span>
                        <span className="underline decoration-dotted underline-offset-2">
                          {log.source}
                        </span>
                      </div>

                      <div className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">
                        {log.message}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(log.id, `${log.source}\n${log.message}\n${log.stack || ''}`)}
                      title="Copy log entry"
                      className="p-1 rounded hover:bg-surface border border-transparent hover:border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedId === log.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Optional Stack Trace block */}
                {log.stack && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => toggleStack(log.id)}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>{isExpanded ? 'Collapse Stack Trace' : 'View Stack Trace'}</span>
                    </button>

                    {isExpanded && (
                      <pre className="mt-1.5 p-2 rounded bg-surface border border-border text-[11px] text-muted-foreground overflow-x-auto leading-tight whitespace-pre">
                        {log.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
