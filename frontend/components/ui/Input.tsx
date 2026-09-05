import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      error,
      disabled,
      leftIcon,
      rightIcon,
      mono = false,
      id,
      ...props
    },
    ref
  ) => {
    const hasError = Boolean(error);

    return (
      <div className="w-full flex flex-col gap-1.5">
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            id={id}
            ref={ref}
            type={type}
            disabled={disabled}
            aria-invalid={hasError}
            className={cn(
              'w-full h-9 rounded-md border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
              hasError
                ? 'border-danger focus-visible:ring-danger'
                : 'border-border hover:border-border-strong',
              Boolean(leftIcon) && 'pl-9',
              Boolean(rightIcon) && 'pr-9',
              mono && 'font-mono text-xs',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
        {typeof error === 'string' && (
          <p className="text-xs text-danger font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
