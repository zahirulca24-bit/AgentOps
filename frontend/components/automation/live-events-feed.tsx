import React from 'react';
import { LiveEventItem } from './pipeline-helper';
import { Card } from '@/components/ui';
import { Activity, CheckCircle2, Loader2, AlertCircle, Info, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LiveEventsFeedProps {
  events: LiveEventItem[];
  isConnected?: boolean;
}

export function LiveEventsFeed({ events, isConnected = false }: LiveEventsFeedProps) {
  return (
    <Card className="p-4 flex flex-col h-[280px] bg-surface overflow-hidden border border-border">
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
            Live Pipeline Events Feed
          </h3>
        </div>
        {isConnected && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-mono font-medium animate-pulse">
            <Radio className="w-3.5 h-3.5" /> SSE Stream Live
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono italic">
            Waiting for live execution events...
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((evt, idx) => {
              const isFirst = idx === 0;
              const isError = evt.status === 'error' || evt.type.includes('fail') || evt.type.includes('error');
              const isSuccess = evt.status === 'success' || evt.type.includes('completed') || evt.type.includes('passed');
              const isRunning = evt.status === 'running' || isFirst;

              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start gap-2.5 p-2 rounded-lg text-xs font-mono border transition-colors ${
                    isFirst
                      ? 'bg-surface-muted/80 border-border/80'
                      : 'bg-surface border-border/40 hover:border-border'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isError ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-primary font-bold uppercase">{evt.type}</span>
                      <span className="text-[10px] text-muted-foreground">{evt.timestamp}</span>
                    </div>
                    <p className="text-foreground leading-snug break-words mt-0.5">{evt.message}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </Card>
  );
}
