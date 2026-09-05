import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, disabled, mono = false, id, ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="w-full flex flex-col gap-1.5">
        <textarea
          id={id}
          ref={ref}
          disabled={disabled}
          aria-invalid={hasError}
          className={cn(
            'w-full min-h-[80px] rounded-md border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
            hasError
              ? 'border-danger focus-visible:ring-danger'
              : 'border-border hover:border-border-strong',
            mono && 'font-mono text-xs leading-relaxed',
            className
          )}
          {...props}
        />
        {typeof error === 'string' && (
          <p className="text-xs text-danger font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
