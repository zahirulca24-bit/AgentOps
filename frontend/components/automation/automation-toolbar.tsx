import React from 'react';
import { Button, Tooltip } from '@/components/ui';
import { Play, Square, ZoomIn, ZoomOut, Maximize, Plus, Save } from 'lucide-react';

interface AutomationToolbarProps {
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

export function AutomationToolbar({
  isRunning,
  onRun,
  onStop,
  onZoomIn,
  onZoomOut,
  onFitView
}: AutomationToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col sm:flex-row gap-2">
      {/* Execution Controls */}
      <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-lg shadow-sm">
        {isRunning ? (
          <Button 
            variant="danger" 
            size="sm" 
            onClick={onStop}
            leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
            className="h-8"
          >
            Stop Workflow
          </Button>
        ) : (
          <Button 
            variant="primary" 
            size="sm" 
            onClick={onRun}
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            className="h-8"
          >
            Run Workflow
          </Button>
        )}
        
        <div className="w-px h-5 bg-border mx-1" />
        
        <Tooltip content="Save Layout" position="bottom">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Save className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>

      {/* View Controls */}
      <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-lg shadow-sm">
        <Tooltip content="Zoom In" position="bottom">
          <Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8 text-muted-foreground">
            <ZoomIn className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Zoom Out" position="bottom">
          <Button variant="ghost" size="icon" onClick={onZoomOut} className="h-8 w-8 text-muted-foreground">
            <ZoomOut className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Fit View" position="bottom">
          <Button variant="ghost" size="icon" onClick={onFitView} className="h-8 w-8 text-muted-foreground">
            <Maximize className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>

      {/* Builder Controls */}
      <div className="flex items-center p-1 bg-surface border border-border rounded-lg shadow-sm">
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" leftIcon={<Plus className="w-4 h-4" />}>
          Add Node
        </Button>
      </div>
    </div>
  );
}
