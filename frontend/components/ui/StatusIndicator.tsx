import React from 'react';
import { cn } from '@/lib/utils';
import { StatusType } from '@/types';

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  status: StatusType;
  label?: string;
  showPulse?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<
  StatusType,
  { dotColor: string; pingColor: string; defaultLabel: string }
> = {
  idle: {
    dotColor: 'bg-zinc-400 dark:bg-zinc-500',
    pingColor: 'bg-zinc-400',
    defaultLabel: 'Idle',
  },
  running: {
    dotColor: 'bg-sky-500',
    pingColor: 'bg-sky-400',
    defaultLabel: 'Running',
  },
  success: {
    dotColor: 'bg-emerald-500',
    pingColor: 'bg-emerald-400',
    defaultLabel: 'Passed',
  },
  warning: {
    dotColor: 'bg-amber-500',
    pingColor: 'bg-amber-400',
    defaultLabel: 'Warning',
  },
  error: {
    dotColor: 'bg-rose-500',
    pingColor: 'bg-rose-400',
    defaultLabel: 'Failed',
  },
};

export function StatusIndicator({
  status,
  label,
  showPulse = true,
  size = 'md',
  className,
  ...props
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const isRunning = status === 'running' && showPulse;

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
  };

  return (
    <div
      className={cn('inline-flex items-center gap-2 select-none', className)}
      role="status"
      aria-label={label || config.defaultLabel}
      {...props}
    >
      <span className="relative flex items-center justify-center shrink-0">
        {isRunning && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              config.pingColor
            )}
          />
        )}
        <span
          className={cn('relative inline-flex rounded-full', dotSizes[size], config.dotColor)}
        />
      </span>
      {label !== undefined ? (
        label ? (
          <span className="text-xs font-mono tracking-wide text-muted-foreground">{label}</span>
        ) : null
      ) : (
        <span className="text-xs font-mono tracking-wide text-muted-foreground">
          {config.defaultLabel}
        </span>
      )}
    </div>
  );
}
