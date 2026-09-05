import React, { useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui';
import { Sparkles, CornerDownLeft, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CommandComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  error?: string | null;
  disabled?: boolean;
}

const SAMPLE_INSPIRATIONS = [
  'Test the login and signup flows on this website.',
  'Verify the checkout funnel and check for Stripe payment errors.',
  'Crawl navigation links and report any 404 dead links.',
  'Assert form field validation when submitting empty or invalid data.',
];

export function CommandComposer({
  value,
  onChange,
  onSubmit,
  error,
  disabled = false,
}: CommandComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle Ctrl+Enter or Cmd+Enter for keyboard submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  const charCount = value.trim().length;
  const isTooShort = charCount > 0 && charCount < 10;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="command-prompt-field"
          className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5"
        >
          <span>Test Objective &amp; Instructions</span>
          <span className="text-primary font-bold">*</span>
        </label>

        {/* Keyboard shortcut hint */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <span>Run:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-surface-muted border border-border text-[10px] text-foreground font-mono shadow-2xs">
            ⌘ + ↵
          </kbd>
          <span className="text-[10px] opacity-70">(or Ctrl+↵)</span>
        </div>
      </div>

      {/* Main Textarea Container */}
      <div className="relative group">
        <Textarea
          id="command-prompt-field"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What should AgentOps test? (e.g. Test the login and signup flows on this website, verify error messages for empty fields, and assert redirection to dashboard.)"
          disabled={disabled}
          error={Boolean(error)}
          className="min-h-[140px] sm:min-h-[160px] text-sm leading-relaxed p-3.5 pb-8 font-sans"
        />

        {/* Bottom meta bar inside textarea frame */}
        <div className="absolute bottom-2.5 right-3 flex items-center gap-3 text-[11px] font-mono pointer-events-none">
          <span
            className={cn(
              'transition-colors',
              isTooShort
                ? 'text-amber-500 font-medium'
                : charCount >= 10
                ? 'text-muted-foreground'
                : 'text-muted-foreground/60'
            )}
          >
            {charCount} chars {charCount > 0 && charCount < 10 ? '(min 10)' : ''}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Inspiration Prompt Quick Chips */}
      <div className="pt-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mb-1.5">
          <Sparkles className="w-3 h-3 text-primary" />
          <span>Example instructions:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_INSPIRATIONS.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onChange(promptText)}
              className="text-[11px] px-2 py-1 rounded-md bg-surface-muted hover:bg-surface-muted/80 border border-border text-muted-foreground hover:text-foreground transition-colors text-left disabled:opacity-50"
            >
              &ldquo;{promptText}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
