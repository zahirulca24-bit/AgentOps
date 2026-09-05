import React from 'react';
import { Button, Tooltip } from '@/components/ui';
import { Link } from '@/lib/router';
import { Plus, Terminal, RotateCcw } from 'lucide-react';

export interface DashboardHeaderProps {
  isEmptyView: boolean;
  onToggleEmptyView: () => void;
}

export function DashboardHeader({
  isEmptyView,
  onToggleEmptyView,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Operations Dashboard
          </h1>
          <span className="hidden sm:inline-flex text-[11px] font-mono px-2 py-0.5 rounded bg-surface-muted border border-border text-muted-foreground">
            live telemetry
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Operational overview of automated QA suites, active agent workers, and test health.
        </p>
      </div>

      <div className="flex items-center gap-2.5 self-start sm:self-center">
        {/* State Toggle for Reviewing Both Operational and Fresh-Install States */}
        <Tooltip
          content={
            isEmptyView
              ? 'Switch to active operational preview'
              : 'Switch to fresh installation empty state'
          }
          position="bottom"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleEmptyView}
            className="text-xs font-mono"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {isEmptyView ? 'View Active State' : 'View Empty State'}
          </Button>
        </Tooltip>

        {/* Primary Action: New QA Run -> /command */}
        <Link href="/command">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            <span>New QA Run</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
