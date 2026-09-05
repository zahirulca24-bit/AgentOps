import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from '@/components/ui';
import { QA_OPTIONS_CONFIG } from '@/lib/command-presets';
import { QAOptionsState } from '@/types';
import { Play, Globe, Bot, ShieldCheck, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RunSummaryCardProps {
  targetUrl: string;
  prompt: string;
  options: QAOptionsState;
  isSubmitting: boolean;
  isValid: boolean;
  onSubmit: () => void;
  onClear: () => void;
}

export function RunSummaryCard({
  targetUrl,
  prompt,
  options,
  isSubmitting,
  isValid,
  onSubmit,
  onClear,
}: RunSummaryCardProps) {
  const enabledOptions = QA_OPTIONS_CONFIG.filter((opt) => options[opt.key]);
  const trimmedUrl = targetUrl.trim();
  const trimmedPrompt = prompt.trim();

  return (
    <Card className="border-border bg-surface shadow-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-foreground">
              Pre-Flight Run Summary
            </CardTitle>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Target Verification
          </span>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Target Host preview */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold tracking-wider block">
              Target Address
            </span>
            <div className="p-2 rounded-md bg-surface-muted border border-border flex items-center gap-2 min-w-0 font-mono">
              <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
              {trimmedUrl ? (
                <span className="text-foreground truncate font-medium text-[11px]">
                  {trimmedUrl}
                </span>
              ) : (
                <span className="text-muted-foreground italic text-[11px]">
                  No target URL specified yet
                </span>
              )}
            </div>
          </div>

          {/* Prompt Objective preview */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold tracking-wider block">
              Execution Objective
            </span>
            <div className="p-2.5 rounded-md bg-surface-muted border border-border min-h-[58px] flex items-start">
              {trimmedPrompt ? (
                <p className="text-foreground leading-relaxed line-clamp-3 text-xs">
                  {trimmedPrompt}
                </p>
              ) : (
                <span className="text-muted-foreground italic text-xs">
                  Awaiting instructions in the prompt composer...
                </span>
              )}
            </div>
          </div>

          {/* Enabled Capabilities list */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold tracking-wider block">
              Active Engines ({enabledOptions.length})
            </span>
            {enabledOptions.length === 0 ? (
              <p className="text-[11px] text-amber-500 font-medium">
                Warning: No QA engines enabled. Select at least one option above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {enabledOptions.map((opt) => (
                  <Badge key={opt.key} variant="neutral" size="sm">
                    {opt.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </div>

      {/* Footer / Submission Controls */}
      <CardFooter className="p-4 border-t border-border/80 bg-surface-muted/30 flex flex-col gap-2.5">
        <div className="w-full flex items-center gap-2">
          {/* Run Agent Primary Button */}
          <Button
            variant="primary"
            size="md"
            disabled={!isValid || isSubmitting}
            onClick={onSubmit}
            className="flex-1 text-xs font-semibold h-10 shadow-xs"
            leftIcon={
              isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )
            }
          >
            <span>{isSubmitting ? 'Staging Execution...' : 'Run Agent'}</span>
            <kbd className="ml-1.5 hidden sm:inline-block text-[10px] font-mono bg-primary-foreground/20 px-1 py-0.5 rounded text-primary-foreground">
              ⌘↵
            </kbd>
          </Button>

          {/* Clear / Reset button */}
          {(trimmedUrl || trimmedPrompt) && (
            <Button
              variant="outline"
              size="md"
              disabled={isSubmitting}
              onClick={onClear}
              className="text-xs h-10 px-3"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Status helper text */}
        <div className="text-center">
          {!isValid ? (
            <span className="text-[11px] text-muted-foreground">
              Specify a valid URL and prompt to run agent
            </span>
          ) : (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Ready for dispatch
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
