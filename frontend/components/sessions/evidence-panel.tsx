import React, { useState } from 'react';
import { EvidenceItem } from '@/types';
import { Camera, Clock, ZoomIn, X, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';

export interface EvidencePanelProps {
  evidence: EvidenceItem[];
  className?: string;
}

export function EvidencePanel({ evidence, className }: EvidencePanelProps) {
  const [activeEvidence, setActiveEvidence] = useState<EvidenceItem | null>(null);

  const renderMockSnapshotVisual = (item: EvidenceItem, isModal = false) => {
    switch (item.mockPreviewType) {
      case 'payment_error':
        return (
          <div
            className={cn(
              'w-full bg-surface border border-rose-500/30 rounded p-3 space-y-2 text-left font-sans',
              isModal ? 'p-6' : 'p-3'
            )}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-rose-500/20">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Payment Gateway Error (DOM Captured)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">HTTP 402</span>
            </div>
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs">
              &ldquo;Card was declined by test bank simulator: requires SCA 3D-Secure authentication.&rdquo;
            </div>
            <div className="p-2 rounded bg-surface-muted border border-border text-[11px] font-mono text-muted-foreground flex justify-between">
              <span>Selector: {item.highlightSelector || 'div.payment-error'}</span>
              <span>Target: Stripe iframe</span>
            </div>
          </div>
        );

      case 'cart_summary':
        return (
          <div
            className={cn(
              'w-full bg-surface border border-emerald-500/30 rounded p-3 space-y-2 text-left font-sans',
              isModal ? 'p-6' : 'p-3'
            )}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Order Summary &amp; Taxes
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                Verified Match
              </span>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal (1 item)</span>
                <span className="font-mono text-foreground">$129.00</span>
              </div>
              <div className="flex justify-between">
                <span>Standard Ground</span>
                <span className="font-mono text-foreground">$12.00</span>
              </div>
              <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border">
                <span>Total Amount</span>
                <span className="font-mono">$141.00</span>
              </div>
            </div>
          </div>
        );

      case 'auth_dialog':
      case 'checkout_step':
      default:
        return (
          <div
            className={cn(
              'w-full bg-surface border border-border rounded p-3 space-y-2 text-left font-sans',
              isModal ? 'p-6' : 'p-3'
            )}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <span className="text-[11px] font-bold text-foreground">
                DOM State Snapshot
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Step #{item.stepNumber}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="p-1.5 rounded bg-surface-muted border border-border font-mono text-[11px] text-muted-foreground truncate">
                {item.highlightSelector || 'form#interactive-flow'}
              </div>
              <p className="text-muted-foreground text-[11px] line-clamp-2">
                {item.caption}
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn('space-y-3 font-sans', className)}>
      <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold text-foreground">
            Captured Visual Evidence ({evidence.length})
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          Step DOM Snapshots
        </span>
      </div>

      {evidence.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
          No visual snapshots captured for this run yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {evidence.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-surface-muted/30 hover:bg-surface-muted/60 transition-all p-3 flex flex-col justify-between space-y-2.5 text-xs group"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-1 font-mono text-[10px] text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded bg-surface border border-border font-semibold text-foreground">
                  Step {item.stepNumber}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.timestamp}
                </span>
              </div>

              {/* Title & Caption */}
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground leading-snug line-clamp-1">
                  {item.title}
                </h4>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {item.caption}
                </p>
              </div>

              {/* Rendered Mock Snapshot Preview Frame */}
              <div className="relative rounded border border-border/80 bg-surface/80 p-2 overflow-hidden">
                {renderMockSnapshotVisual(item, false)}

                {/* Hover inspect overlay */}
                <button
                  type="button"
                  onClick={() => setActiveEvidence(item)}
                  className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-xs font-semibold text-foreground backdrop-blur-2xs"
                >
                  <ZoomIn className="w-4 h-4 text-primary" />
                  <span>Inspect Evidence</span>
                </button>
              </div>

              {/* Footer Button */}
              <div className="pt-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveEvidence(item)}
                  className="h-6 px-2 text-[11px] text-primary"
                  leftIcon={<ZoomIn className="w-3 h-3" />}
                >
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Detail View Overlay */}
      {activeEvidence && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setActiveEvidence(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">
                  {activeEvidence.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveEvidence(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-muted-foreground pb-2 border-b border-border/60">
                <span>Associated: {activeEvidence.stepName}</span>
                <span>Captured: {activeEvidence.timestamp}</span>
              </div>

              {/* Snapshot container */}
              <div className="p-3 rounded-lg border border-border bg-surface-muted/40">
                {renderMockSnapshotVisual(activeEvidence, true)}
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[10px] font-mono">
                  Agent Observation
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  {activeEvidence.caption}
                </p>
              </div>
            </div>

            <div className="p-3 bg-surface-muted/40 border-t border-border flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveEvidence(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
