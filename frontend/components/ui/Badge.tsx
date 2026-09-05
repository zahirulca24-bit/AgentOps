import React from 'react';
import { cn } from '@/lib/utils';
import { BadgeVariant } from '@/types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  key?: React.Key;
  className?: string;
  children?: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  withDot?: boolean;
  dotClassName?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  default: {
    container: 'bg-surface-muted text-foreground border-border',
    dot: 'bg-primary',
  },
  secondary: {
    container: 'bg-secondary text-secondary-foreground border-border',
    dot: 'bg-muted-foreground',
  },
  outline: {
    container: 'bg-transparent text-foreground border-border',
    dot: 'bg-muted-foreground',
  },
  success: {
    container: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  warning: {
    container: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  danger: {
    container: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  info: {
    container: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    dot: 'bg-sky-500',
  },
  neutral: {
    container: 'bg-surface-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
};

const sizeStyles = {
  sm: 'text-[11px] px-2 py-0.5 gap-1.5 font-medium',
  md: 'text-xs px-2.5 py-1 gap-2 font-medium',
};

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  withDot = false,
  dotClassName,
  children,
  ...props
}: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-mono uppercase tracking-wider select-none',
        styles.container,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {withDot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot, dotClassName)}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
