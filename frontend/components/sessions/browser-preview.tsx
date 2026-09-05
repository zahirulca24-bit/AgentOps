import React, { useState } from 'react';
import { BrowserSession } from '@/types';
import {
  Lock,
  RotateCw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  MousePointer,
  Crosshair,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';
import { motion, AnimatePresence } from 'motion/react';

export interface BrowserPreviewProps {
  session: BrowserSession;
  className?: string;
}

type PreviewViewMode = 'simulated_dom' | 'loading' | 'unavailable';

export function BrowserPreview({ session, className }: BrowserPreviewProps) {
  const [viewMode, setViewMode] = useState<PreviewViewMode>('simulated_dom');
  const [showAgentOverlay, setShowAgentOverlay] = useState<boolean>(true);

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface overflow-hidden shadow-xs flex flex-col',
        className
      )}
    >
      {/* 1. Browser-like Chrome Frame Top Bar */}
      <div className="bg-surface-muted/80 border-b border-border px-3.5 py-2 flex items-center justify-between gap-2 select-none">
        {/* Traffic light window controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 border border-rose-600/30" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 border border-amber-600/30" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 border border-emerald-600/30" />
        </div>

        {/* Current URL Bar */}
        <div className="flex-1 max-w-xl mx-2">
          <div className="h-7 px-2.5 rounded-md bg-surface border border-border flex items-center gap-2 text-xs font-mono text-muted-foreground shadow-2xs">
            <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-foreground truncate select-all">
              {session.targetUrl}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground/60 hidden sm:inline-block shrink-0">
              HTTPS
            </span>
          </div>
        </div>

        {/* Viewport Meta & Quick Mode Controls */}
        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono text-muted-foreground">
          <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-surface border border-border text-[10px]">
            {session.viewport.width} × {session.viewport.height}
          </span>

          {/* Mode Switcher for UI verification */}
          <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('simulated_dom')}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-colors',
                viewMode === 'simulated_dom'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="View Simulated DOM Render"
            >
              Live DOM
            </button>
            <button
              type="button"
              onClick={() => setViewMode('loading')}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-colors',
                viewMode === 'loading'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Test Loading State"
            >
              Loading
            </button>
            <button
              type="button"
              onClick={() => setViewMode('unavailable')}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-colors',
                viewMode === 'unavailable'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Test Unavailable State"
            >
              Offline
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Viewport Container */}
      <div className="relative min-h-[380px] sm:min-h-[460px] bg-zinc-950/5 dark:bg-zinc-900/40 p-3 sm:p-4 flex flex-col justify-center items-center overflow-auto">
        <AnimatePresence mode="wait">
          {viewMode === 'loading' ? (
            /* Loading State */
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="text-center p-8 space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-sm">
                  Navigating to Target DOM
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Headless browser worker is rendering the page tree and awaiting network idle state.
                </p>
              </div>
            </motion.div>
          ) : viewMode === 'unavailable' ? (
            /* Unavailable / Disconnected State */
            <motion.div
              key="unavailable"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="text-center p-8 space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-sm">
                  Browser Stream Unavailable
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Target server did not respond or headless browser crashed during frame handshake.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('simulated_dom')}
                className="text-xs"
              >
                Restore Simulated View
              </Button>
            </motion.div>
          ) : (
            /* High-Fidelity Frame-Safe Simulated DOM Viewport */
            <motion.div
              key="simulated_dom"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl bg-surface border border-border rounded-lg shadow-sm p-4 sm:p-6 space-y-5 text-left relative"
            >
              {/* Agent Inspection Highlight Overlay */}
              <AnimatePresence>
                {showAgentOverlay && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 border border-primary/30 text-[11px] font-mono text-primary z-10"
                  >
                    <Crosshair className="w-3 h-3 animate-spin" />
                    <span>Agent Target: input[data-testid=&quot;card-number&quot;]</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Simulated Target Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                    M
                  </div>
                  <span className="font-bold text-sm text-foreground">
                    ModernStore Demo
                  </span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  Step: 4 of 5
                </span>
              </div>

              {/* Simulated Checkout Form Body */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-foreground">
                    1. Contact Information
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-surface-muted border border-border font-mono text-muted-foreground">
                      alex.dev@example.com
                    </div>
                    <div className="p-2 rounded bg-surface-muted border border-border font-mono text-muted-foreground">
                      Alex Mercer
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold text-foreground">
                    2. Shipping Method
                  </span>
                  <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium text-foreground">
                        Standard Ground (3-5 business days)
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-foreground">
                      $12.00
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      3. Payment Details
                    </span>
                    <Badge variant="danger" size="sm">
                      402 Payment Rejection
                    </Badge>
                  </div>

                  {/* The highlighted element with simulated agent focus ring */}
                  <div className="relative p-3 rounded-lg border-2 border-primary bg-primary/5 space-y-2">
                    {/* Simulated Agent Pointer Outline Pulse */}
                    <AnimatePresence>
                      {showAgentOverlay && (
                        <motion.div
                          className="absolute inset-0 border-2 border-primary rounded-lg z-0"
                          initial={{ opacity: 0.5, scale: 1 }}
                          animate={{ opacity: 0, scale: 1.05 }}
                          exit={{ opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                        />
                      )}
                    </AnimatePresence>
                    
                    <div className="flex items-center justify-between text-xs relative z-10">
                      <span className="font-mono text-[11px] text-primary font-semibold">
                        Card Number (Simulated Stripe Elements)
                      </span>
                      <span className="text-[10px] font-mono text-rose-500 font-semibold">
                        Card declined / 3DS required
                      </span>
                    </div>
                    <div className="p-2 rounded bg-surface border border-primary/40 font-mono text-xs text-foreground flex items-center justify-between relative z-10">
                      <span>•••• •••• •••• 4242</span>
                      <span className="text-[10px] text-muted-foreground">08/28</span>
                    </div>

                    {/* Agent pointer cursor badge */}
                    <AnimatePresence>
                      {showAgentOverlay && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="absolute -bottom-3 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono shadow-md z-10"
                        >
                          <MousePointer className="w-2.5 h-2.5 fill-current" />
                          <span>Agent cursor click target</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Simulated Order Total Summary */}
              <div className="p-3 rounded-lg bg-surface-muted/50 border border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Order Total (Subtotal $129.00 + Shipping $12.00)
                </span>
                <span className="font-bold text-sm font-mono text-foreground">
                  $141.00 USD
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Bottom Safe Preview Disclaimer Bar */}
      <div className="bg-surface-muted/50 border-t border-border px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>Local Frame-Safe Preview (No insecure iframe embedding)</span>
        </div>
        <button
          type="button"
          onClick={() => setShowAgentOverlay((prev) => !prev)}
          className="hover:text-foreground underline transition-colors"
        >
          {showAgentOverlay ? 'Hide Action Overlay' : 'Show Action Overlay'}
        </button>
      </div>
    </div>
  );
}
