import React from 'react';
import { Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'default' | 'running' | 'success' | 'danger' | 'warning';
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
  className,
}: MetricCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'running':
        return {
          iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
          accent: 'text-sky-600 dark:text-sky-400',
        };
      case 'success':
        return {
          iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          accent: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'danger':
        return {
          iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          accent: 'text-rose-600 dark:text-rose-400',
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          accent: 'text-amber-600 dark:text-amber-400',
        };
      default:
        return {
          iconBg: 'bg-surface-muted text-muted-foreground border-border',
          accent: 'text-foreground',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className={cn('relative overflow-hidden transition-all duration-150', className)}>
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
        {/* Header: Label + Status Icon */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <div
            className={cn(
              'w-8 h-8 rounded-md border flex items-center justify-center shrink-0',
              styles.iconBg
            )}
            aria-hidden="true"
          >
            <Icon className="w-4 h-4" />
          </div>
        </div>

        {/* Big Numeric Value & Subtext */}
        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
            {value}
          </div>
          {subtext && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {subtext}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
