import React from 'react';
import { AutomationNodeData } from '@/types';
import { X, Cpu, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { motion, AnimatePresence } from 'motion/react';

interface NodeInspectorProps {
  nodeData: AutomationNodeData | null;
  onClose: () => void;
}

export function NodeInspector({ nodeData, onClose }: NodeInspectorProps) {
  if (!nodeData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute top-4 bottom-4 right-4 w-80 bg-surface border border-border shadow-xl rounded-xl flex flex-col z-20 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-muted/30">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Node Inspector</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Node Identity */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{nodeData.label}</h2>
              <Badge 
                variant={
                  nodeData.status === 'success' ? 'success' :
                  nodeData.status === 'running' ? 'info' :
                  nodeData.status === 'error' ? 'danger' : 'neutral'
                } 
                size="sm"
              >
                {nodeData.status}
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground">Type: {nodeData.type}</p>
            {nodeData.subtitle && <p className="text-sm text-muted-foreground">{nodeData.subtitle}</p>}
          </div>

          {/* Status Indicator */}
          {nodeData.status === 'running' && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-primary">Node Executing</p>
                {nodeData.progress !== undefined && (
                  <div className="mt-1.5 h-1 w-full bg-primary/20 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${nodeData.progress}%` }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata Fields */}
          {nodeData.metadata && Object.keys(nodeData.metadata).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Execution Data</h4>
              <div className="space-y-2">
                {Object.entries(nodeData.metadata).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5 p-2 rounded border border-border bg-surface-muted/30">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{key}</span>
                    <span className="text-xs font-medium text-foreground">
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Config Summary (mock) */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Configuration</h4>
            <div className="p-3 rounded bg-surface-muted border border-border text-xs text-muted-foreground">
              Configuration is read-only during active executions.
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
