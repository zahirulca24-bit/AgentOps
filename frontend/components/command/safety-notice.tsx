import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

export function SafetyNotice() {
  return (
    <div className="p-3 rounded-lg border border-border bg-surface-muted/50 text-xs text-muted-foreground flex items-start gap-2.5">
      <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <span className="font-semibold text-foreground text-xs">
          Authorized Testing Policy
        </span>
        <p className="text-[11px] leading-relaxed">
          Only dispatch AgentOps against web applications and staging environments you own or are explicitly authorized to test. Autonomous browser agents perform direct interactions, form submissions, and DOM state assertions.
        </p>
      </div>
    </div>
  );
}
