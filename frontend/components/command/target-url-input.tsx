import React from 'react';
import { Input } from '@/components/ui';
import { Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TargetUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export function TargetUrlInput({
  value,
  onChange,
  error,
  disabled = false,
}: TargetUrlInputProps) {
  const isValid = Boolean(value.trim() && !error && /^https?:\/\/.+\..+/i.test(value.trim()));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor="target-url-field"
          className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5"
        >
          <span>Target Website / Environment</span>
          <span className="text-primary font-bold">*</span>
        </label>

        {/* Quick Protocol Helper buttons if empty */}
        {!value && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <span>Quick prefix:</span>
            <button
              type="button"
              onClick={() => onChange('https://')}
              className="px-1.5 py-0.5 rounded hover:bg-surface-muted text-primary hover:underline transition-colors"
            >
              https://
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <Input
          id="target-url-field"
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com"
          disabled={disabled}
          error={Boolean(error)}
          mono
          leftIcon={<Globe className="w-4 h-4" />}
          rightIcon={
            isValid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : error ? (
              <AlertCircle className="w-4 h-4 text-rose-500" />
            ) : undefined
          }
          className="h-10 text-sm font-mono"
        />
      </div>

      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Autonomous agents will launch a clean browser instance targeting this root domain.
        </p>
      )}
    </div>
  );
}
