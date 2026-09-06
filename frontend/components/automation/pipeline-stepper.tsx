import React from 'react';
import { PipelineStep } from './pipeline-helper';
import { Badge, Card } from '@/components/ui';
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Clock, 
  FileSearch, 
  Compass, 
  Sparkles, 
  Play, 
  Camera, 
  Bug, 
  FileText,
  ChevronRight 
} from 'lucide-react';
import { motion } from 'motion/react';

interface PipelineStepperProps {
  steps: PipelineStep[];
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  plan: <FileSearch className="w-4 h-4" />,
  explore: <Compass className="w-4 h-4" />,
  generate: <Sparkles className="w-4 h-4" />,
  execute: <Play className="w-4 h-4" />,
  evidence: <Camera className="w-4 h-4" />,
  issues: <Bug className="w-4 h-4" />,
  report: <FileText className="w-4 h-4" />,
};

export function PipelineStepper({ steps }: PipelineStepperProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
          <span>QA Pipeline Steps</span>
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          {steps.filter(s => s.status === 'passed').length}/{steps.length} Steps Completed
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {steps.map((step, idx) => {
          const isPassed = step.status === 'passed';
          const isRunning = step.status === 'running';
          const isFailed = step.status === 'failed';
          const isPending = step.status === 'pending';

          const icon = STEP_ICONS[step.id] || <Clock className="w-4 h-4" />;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04 }}
              className="relative"
            >
              <Card
                className={`p-3.5 flex flex-col justify-between h-full border transition-all duration-200 ${
                  isRunning
                    ? 'border-primary/60 bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/30'
                    : isPassed
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : isFailed
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : 'border-border/60 bg-surface/50 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isRunning
                          ? 'bg-primary text-primary-foreground animate-pulse'
                          : isPassed
                          ? 'bg-emerald-500 text-white'
                          : isFailed
                          ? 'bg-rose-500 text-white'
                          : 'bg-surface-muted text-muted-foreground'
                      }`}
                    >
                      {isRunning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isPassed ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isFailed ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        icon
                      )}
                    </div>
                    <Badge
                      variant={
                        isRunning
                          ? 'info'
                          : isPassed
                          ? 'success'
                          : isFailed
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {step.status}
                    </Badge>
                  </div>

                  <h4 className="font-semibold text-xs text-foreground tracking-tight flex items-center gap-1">
                    {step.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {step.description}
                  </p>
                </div>

                {step.details && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground truncate">
                    {step.details}
                  </div>
                )}
              </Card>

              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/40">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
