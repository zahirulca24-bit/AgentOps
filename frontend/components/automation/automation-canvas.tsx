import React, { useState, useCallback, useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  MiniMap, 
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow,
  Panel
} from '@xyflow/react';
import { AutomationWorkflow, AutomationNodeData } from '@/types';
import { AgentOpsNode } from './automation-node';
import { NodeInspector } from './node-inspector';
import { ExecutionPanel } from './execution-panel';
import { AutomationToolbar } from './automation-toolbar';
import { useTheme } from '@/lib/theme';

const nodeTypes = {
  agentopsNode: AgentOpsNode as any,
};

interface AutomationCanvasInnerProps {
  initialWorkflow: AutomationWorkflow;
}

function AutomationCanvasInner({ initialWorkflow }: AutomationCanvasInnerProps) {
  const { theme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow.edges);
  
  const [selectedNodeData, setSelectedNodeData] = useState<AutomationNodeData | null>(null);
  
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  // Attach onSelect to each node's data
  const processedNodes = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onSelect: () => setSelectedNodeData(node.data as AutomationNodeData)
      }
    }));
  }, [nodes]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeData(null);
  }, []);

  const handleRun = useCallback(() => {
    // In a real app, dispatch to backend.
    // For this preview, we are just visually acknowledging the click.
  }, []);

  const handleStop = useCallback(() => {
    // Stop run
  }, []);

  const isDarkMode = theme === 'dark';

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-border bg-surface shadow-xs">
      <AutomationToolbar 
        isRunning={initialWorkflow.status === 'running'}
        onRun={handleRun}
        onStop={handleStop}
        onZoomIn={() => zoomIn({ duration: 300 })}
        onZoomOut={() => zoomOut({ duration: 300 })}
        onFitView={() => fitView({ duration: 500, padding: 0.2 })}
      />
      
      <ReactFlow
        nodes={processedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        className="automation-react-flow"
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          color={isDarkMode ? "#27272a" : "#e2e8f0"} 
          gap={16} 
          size={1} 
        />
        
        {/* Custom Controls are built via AutomationToolbar, standard xyflow controls hidden or bottom right */}
        {/* We can use MiniMap at the bottom right */}
        <MiniMap 
          nodeColor={isDarkMode ? "#27272a" : "#cbd5e1"}
          maskColor={isDarkMode ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.5)"}
          style={{ 
            backgroundColor: isDarkMode ? "#111114" : "#ffffff",
            border: isDarkMode ? "1px solid #27272a" : "1px solid #e2e8f0",
            borderRadius: "0.5rem"
          }}
          className="shadow-sm"
        />
        
      </ReactFlow>

      {/* Overlays */}
      <ExecutionPanel events={initialWorkflow.events} />
      <NodeInspector 
        nodeData={selectedNodeData} 
        onClose={() => setSelectedNodeData(null)} 
      />
    </div>
  );
}

export interface AutomationCanvasProps {
  initialWorkflow: AutomationWorkflow;
}

export function AutomationCanvas(props: AutomationCanvasProps) {
  return (
    <ReactFlowProvider>
      <AutomationCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
