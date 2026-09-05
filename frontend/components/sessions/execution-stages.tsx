import React from 'react';
import { ExecutionStageName, StageInfo, StageState } from '@/types';
import { EXECUTION_STAGE_NAMES } from '@/lib/mock-sessions';
import { Check, Loader2, AlertTriangle, Square, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export interface ExecutionStagesProps {
  stages: StageInfo[];
  currentStage: ExecutionStageName;
  className?: string;
}

export function ExecutionStages({ stages, currentStage, className }: ExecutionStagesProps) {
  // Build a map of provided stages
  const stageMap = new Map<ExecutionStageName, StageInfo>();
  stages.forEach((s) => stageMap.set(s.name, s));

  const getStageState = (name: ExecutionStageName): StageState => {
    const existing = stageMap.get(name);
    if (existing) return existing.state;

    // Fallback based on position relative to currentStage
    const currentIndex = EXECUTION_STAGE_NAMES.indexOf(currentStage);
    const thisIndex = EXECUTION_STAGE_NAMES.indexOf(name);

    if (thisIndex < currentIndex) return 'completed';
    if (thisIndex === currentIndex) return 'active';
    return 'pending';
  };

  const renderIcon = (state: StageState) => {
    switch (state) {
      case 'completed':
        return <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}><Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" /></motion.div>;
      case 'active':
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />;
      case 'failed':
        return <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}><AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /></motion.div>;
      case 'stopped':
        return <Square className="w-3 h-3 fill-current text-zinc-500" />;
      case 'pending':
      default:
        return <Circle className="w-2.5 h-2.5 fill-muted-foreground/30 text-transparent" />;
    }
  };

  return (
    <div
      className={cn(
        'p-3.5 sm:p-4 rounded-xl border border-border bg-surface shadow-2xs',
        className
      )}
      aria-label="Execution Pipeline Stages"
    >
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-border/70 text-xs">
        <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] font-mono">
          Execution Lifecycle Pipeline
        </span>
        <span className="text-[11px] font-mono text-muted-foreground">
          Stage:{' '}
          <strong className="text-foreground font-semibold">
            {currentStage}
          </strong>
        </span>
      </div>

      {/* Responsive Stages Pipeline */}
      <div className="relative">
        <ol className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5">
          {EXECUTION_STAGE_NAMES.map((stageName, index) => {
            const state = getStageState(stageName);
            const stageData = stageMap.get(stageName);
            const isCurrent = stageName === currentStage;

            return (
              <motion.li
                layout
                key={stageName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={cn(
                  'relative rounded-lg p-2 sm:p-2.5 border transition-all text-left flex flex-col justify-between min-h-[64px]',
                  isCurrent
                    ? 'border-primary/50 bg-primary/5 shadow-2xs'
                    : state === 'completed'
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : state === 'failed'
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : state === 'stopped'
                    ? 'border-zinc-500/30 bg-zinc-500/5'
                    : 'border-border/60 bg-surface-muted/30 opacity-75'
                )}
              >
                {/* Active pulse effect */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 border-2 border-primary rounded-lg z-0"
                    initial={{ opacity: 0.5, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.05 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                  />
                )}
                <div className="flex items-center justify-between gap-1 mb-1 relative z-10">
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                    0{index + 1}
                  </span>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-surface border border-border/80 shrink-0">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={state}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                      >
                        {renderIcon(state)}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                <div className="space-y-0.5 relative z-10">
                  <div
                    className={cn(
                      'text-xs font-semibold leading-tight line-clamp-1 transition-colors',
                      isCurrent
                        ? 'text-primary'
                        : state === 'completed'
                        ? 'text-foreground'
                        : state === 'failed'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    {stageName}
                  </div>
                  {stageData?.duration && (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] font-mono text-muted-foreground block truncate"
                    >
                      {stageData.duration}
                    </motion.span>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
