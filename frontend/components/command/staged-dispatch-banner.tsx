import React from 'react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { StagedDispatchPayload } from '@/types';
import { CheckCircle2, X, Terminal, Globe, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from '@/lib/router';

export interface StagedDispatchBannerProps {
  payload: StagedDispatchPayload;
  onDismiss: () => void;
}

export function StagedDispatchBanner({
  payload,
  onDismiss,
}: StagedDispatchBannerProps) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs animate-in fade-in duration-150">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>

          <div className="space-y-1 min-w-0 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground text-sm">
                Command Ready for Execution
              </span>
              <Badge variant="success" size="sm" withDot>
                Frontend Staged
              </Badge>
              <span className="font-mono text-[11px] text-muted-foreground">
                ID: {payload.stagedId}
              </span>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Target validated:{' '}
              <span className="font-mono font-medium text-foreground">
                {payload.targetUrl}
              </span>
              . In future backend phases (Prompt 6+), this payload will trigger autonomous headless Chrome browser workers.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-mono text-muted-foreground">
              <span>{payload.enabledOptions.length} QA engines staged</span>
              <span>•</span>
              <span>{payload.stagedAt}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Link href="/sessions">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Go to Sessions
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss staged confirmation"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
