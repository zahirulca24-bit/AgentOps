import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AutomationNodeData } from '@/types';
import { cn } from '@/lib/utils';
import { 
  Play, 
  BrainCircuit, 
  Globe, 
  Beaker, 
  Zap, 
  BarChart, 
  FileBox,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

const NODE_ICONS = {
  trigger: Play,
  planner: BrainCircuit,
  explorer: Globe,
  generator: Beaker,
  executor: Zap,
  analysis: BarChart,
  report: FileBox,
};

export function AgentOpsNode({ data, selected }: NodeProps<any>) {
  const nodeData = data as AutomationNodeData;
  const Icon = NODE_ICONS[nodeData.type] || Globe;
  const prefersReducedMotion = useReducedMotion();
  
  const isRunning = nodeData.status === 'running';
  const isSuccess = nodeData.status === 'success';
  const isWarning = nodeData.status === 'warning';
  const isError = nodeData.status === 'error';
  const isIdle = nodeData.status === 'idle' || nodeData.status === 'queued';

  return (
    <div 
      className={cn(
        "relative flex flex-col min-w-[240px] bg-surface rounded-xl border border-border shadow-xs transition-all duration-200 cursor-pointer overflow-hidden",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary",
        isRunning && "border-primary/50 shadow-[0_0_15px_rgba(56,189,248,0.15)]",
        isSuccess && "border-emerald-500/30",
        isError && "border-rose-500/50"
      )}
      onClick={nodeData.onSelect}
    >
      {/* Handles */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className={cn(
          "w-3 h-3 !bg-surface !border-2 !border-muted-foreground",
          selected && "!border-primary"
        )} 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className={cn(
          "w-3 h-3 !bg-surface !border-2 !border-muted-foreground",
          selected && "!border-primary"
        )} 
      />

      {/* Running pulse effect */}
      <AnimatePresence>
        {isRunning && !prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 bg-primary/5 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 flex items-start gap-3 p-3">
        {/* Node Icon */}
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border",
          isRunning ? "bg-primary/10 border-primary/20 text-primary" :
          isSuccess ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
          isError ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400" :
          "bg-surface-muted border-border text-foreground"
        )}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Node Title & Subtitle */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex justify-between items-center gap-2">
            <h3 className="text-sm font-bold text-foreground truncate">{nodeData.label}</h3>
            {/* Status Icon Indicator */}
            <div className="shrink-0 flex items-center justify-center">
              {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
              {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {isError && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
              {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            </div>
          </div>
          {nodeData.subtitle && (
            <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">{nodeData.subtitle}</p>
          )}
        </div>
      </div>

      {/* Progress Bar (if running and progress exists) */}
      {isRunning && nodeData.progress !== undefined && (
        <div className="h-1 w-full bg-surface-muted relative z-10">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${nodeData.progress}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          />
        </div>
      )}
      
      {/* Node specific metadata pills if any */}
      {nodeData.metadata && Object.keys(nodeData.metadata).length > 0 && !isRunning && (
        <div className="px-3 pb-3 relative z-10 flex flex-wrap gap-1.5 mt-1">
          {Object.entries(nodeData.metadata).slice(0, 2).map(([key, val]) => (
            <span key={key} className="inline-flex px-1.5 py-0.5 rounded bg-surface-muted border border-border text-[9px] font-mono text-muted-foreground uppercase">
              {key}: {String(val)}
            </span>
          ))}
          {Object.keys(nodeData.metadata).length > 2 && (
            <span className="inline-flex px-1.5 py-0.5 rounded bg-surface-muted border border-border text-[9px] font-mono text-muted-foreground">
              +{Object.keys(nodeData.metadata).length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
