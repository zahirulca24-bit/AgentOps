import { AutomationWorkflow, AutomationEvent } from '@/types';
import { Edge, Node } from '@xyflow/react';

const mockNodes: Node[] = [
  {
    id: 'trigger',
    type: 'agentopsNode',
    position: { x: 50, y: 150 },
    data: {
      label: 'Trigger',
      subtitle: 'Manual Execution',
      type: 'trigger',
      status: 'success',
      metadata: {
        triggerType: 'Manual',
        user: 'admin@agentops.ai'
      }
    },
  },
  {
    id: 'planner',
    type: 'agentopsNode',
    position: { x: 300, y: 150 },
    data: {
      label: 'AI Planner',
      subtitle: 'Objective Analysis',
      type: 'planner',
      status: 'success',
      metadata: {
        objective: 'Full QA Pass on main target',
        stepsGenerated: 7,
        capabilities: ['navigation', 'assertion', 'visual']
      }
    },
  },
  {
    id: 'explorer',
    type: 'agentopsNode',
    position: { x: 550, y: 150 },
    data: {
      label: 'Website Explorer',
      subtitle: 'DOM Discovery',
      type: 'explorer',
      status: 'running',
      progress: 65,
      metadata: {
        pagesDiscovered: 12,
        formsDiscovered: 3,
        linksDiscovered: 84,
        currentPage: '/checkout'
      }
    },
  },
  {
    id: 'generator',
    type: 'agentopsNode',
    position: { x: 800, y: 150 },
    data: {
      label: 'Generate Tests',
      subtitle: 'Test Synthesis',
      type: 'generator',
      status: 'queued',
      metadata: {
        testsGenerated: 0,
        functional: 0,
        visual: 0
      }
    },
  },
  {
    id: 'executor',
    type: 'agentopsNode',
    position: { x: 1050, y: 150 },
    data: {
      label: 'Execute Tests',
      subtitle: 'Browser Action',
      type: 'executor',
      status: 'idle',
      metadata: {
        currentTest: '-',
        passed: 0,
        failed: 0,
        remaining: 0
      }
    },
  },
  {
    id: 'analysis',
    type: 'agentopsNode',
    position: { x: 1300, y: 50 },
    data: {
      label: 'Analyze Results',
      subtitle: 'Review metrics',
      type: 'analysis',
      status: 'idle',
      metadata: {
        issuesFound: 0,
        warnings: 0
      }
    },
  },
  {
    id: 'report',
    type: 'agentopsNode',
    position: { x: 1300, y: 250 },
    data: {
      label: 'Evidence Report',
      subtitle: 'Artifact Generation',
      type: 'report',
      status: 'idle',
      metadata: {
        screenshots: 0,
        consoleLogs: 0,
        networkLogs: 0
      }
    },
  },
];

const mockEdges: Edge[] = [
  { id: 'e-trigger-planner', source: 'trigger', target: 'planner', animated: false },
  { id: 'e-planner-explorer', source: 'planner', target: 'explorer', animated: false },
  { id: 'e-explorer-generator', source: 'explorer', target: 'generator', animated: true },
  { id: 'e-generator-executor', source: 'generator', target: 'executor' },
  { id: 'e-executor-analysis', source: 'executor', target: 'analysis' },
  { id: 'e-executor-report', source: 'executor', target: 'report' },
];

const mockEvents: AutomationEvent[] = [
  { id: 'ev1', timestamp: '10:14:22', message: 'Run started manually by user', nodeId: 'trigger', status: 'success' },
  { id: 'ev2', timestamp: '10:14:24', message: 'AI Planner analyzed objective', nodeId: 'planner', status: 'running' },
  { id: 'ev3', timestamp: '10:14:26', message: 'Generated 7 step execution plan', nodeId: 'planner', status: 'success' },
  { id: 'ev4', timestamp: '10:14:28', message: 'Website Explorer initialized on target URL', nodeId: 'explorer', status: 'running' },
  { id: 'ev5', timestamp: '10:14:31', message: 'Found authentication form and checkout flow', nodeId: 'explorer', status: 'running' },
  { id: 'ev6', timestamp: '10:14:35', message: 'Scanning DOM for interactive elements...', nodeId: 'explorer', status: 'running' },
];

export const MOCK_WORKFLOW: AutomationWorkflow = {
  id: 'wf_prod_9942',
  name: 'Standard QA Execution Pipeline',
  description: 'Full automated discovery, test generation, and browser execution workflow.',
  nodes: mockNodes,
  edges: mockEdges,
  events: mockEvents,
  status: 'running',
  startedAt: '10:14:22 AM',
  elapsedTime: '00:01:24',
};
