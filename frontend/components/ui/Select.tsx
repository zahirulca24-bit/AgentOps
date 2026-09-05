import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean | string;
  mono?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, disabled, mono = false, id, ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="w-full flex flex-col gap-1.5">
        <div className="relative flex items-center w-full">
          <select
            id={id}
            ref={ref}
            disabled={disabled}
            aria-invalid={hasError}
            className={cn(
              'w-full h-9 appearance-none rounded-md border bg-surface px-3 py-1.5 pr-8 text-sm text-foreground transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
              hasError
                ? 'border-danger focus-visible:ring-danger'
                : 'border-border hover:border-border-strong',
              mono && 'font-mono text-xs',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
        </div>
        {typeof error === 'string' && (
          <p className="text-xs text-danger font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
