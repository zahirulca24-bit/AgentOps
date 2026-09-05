import React from 'react';
import { AutomationEvent } from '@/types';
import { Activity, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ExecutionPanelProps {
  events: AutomationEvent[];
}

export function ExecutionPanel({ events }: ExecutionPanelProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10 w-80 bg-surface border border-border shadow-xl rounded-xl flex flex-col overflow-hidden max-h-[300px]">
      <div className="flex items-center gap-2 p-3 border-b border-border bg-surface-muted/30">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">Live Execution Feed</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {events.map((event, i) => {
              const isLast = i === events.length - 1;
              const isRunning = event.status === 'running' && isLast;
              const isSuccess = event.status === 'success';
              const isError = event.status === 'error';
              
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div className="shrink-0 mt-0.5">
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isError ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 bg-surface-muted" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground">{event.timestamp}</span>
                    <span className="text-xs text-foreground leading-snug break-words">
                      {event.message}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
