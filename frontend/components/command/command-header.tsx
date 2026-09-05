import React from 'react';
import { StatusIndicator, Button } from '@/components/ui';
import { Link } from '@/lib/router';
import { Terminal, ArrowLeft, RotateCcw } from 'lucide-react';

export interface CommandHeaderProps {
  onReset: () => void;
  hasInput: boolean;
}

export function CommandHeader({ onReset, hasInput }: CommandHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
            <Terminal className="w-4 h-4" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            AI Command Center
          </h1>
          <span className="hidden sm:inline-flex text-[11px] font-mono px-2 py-0.5 rounded bg-surface-muted border border-border text-muted-foreground">
            v1.0 orchestration
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Compose autonomous QA instructions, configure inspection engines, and dispatch browser agent workers.
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
        <StatusIndicator status="idle" label="Engine: Ready" showPulse={false} />

        {hasInput && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="text-xs"
            leftIcon={<RotateCcw className="w-3 h-3" />}
          >
            Reset Form
          </Button>
        )}
      </div>
    </div>
  );
}
