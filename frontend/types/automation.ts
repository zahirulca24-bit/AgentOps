export type AutomationNodeType = 
  | 'trigger' 
  | 'planner' 
  | 'explorer' 
  | 'generator' 
  | 'executor' 
  | 'analysis' 
  | 'report';

export type AutomationNodeStatus = 
  | 'idle' 
  | 'queued' 
  | 'running' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'stopped';

export interface AutomationNodeData {
  label: string;
  subtitle?: string;
  type: AutomationNodeType;
  status: AutomationNodeStatus;
  progress?: number;
  metadata?: Record<string, any>;
  onSelect?: () => void;
}

export interface AutomationEvent {
  id: string;
  timestamp: string;
  message: string;
  nodeId?: string;
  status?: AutomationNodeStatus;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: any[]; // using any for xyflow nodes in preview
  edges: any[]; // using any for xyflow edges in preview
  events: AutomationEvent[];
  status: AutomationNodeStatus;
  startedAt?: string;
  elapsedTime?: string;
}
