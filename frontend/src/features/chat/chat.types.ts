export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface StreamState {
  streamId: string | null;
  isStreaming: boolean;
  error: string | null;
}

// --- Workflow SSE event types ---

export type WorkflowEventType =
  | 'connected'
  | 'run.started'
  | 'node.started'
  | 'node.delta'
  | 'node.completed'
  | 'node.failed'
  | 'run.completed';

export interface WorkflowEvent {
  type: WorkflowEventType;
  runId: string;
  node?: string;
  data?: unknown;
  timestamp: string;
}

export interface NodeResult {
  [agentName: string]: unknown;
}

export type AgentName = 'planner' | 'research' | 'product' | 'prd' | 'task';

export const AGENT_ORDER: AgentName[] = ['planner', 'research', 'product', 'prd', 'task'];

export const AGENT_LABELS: Record<AgentName, string> = {
  planner: 'Planner',
  research: 'Research',
  product: 'Product',
  prd: 'PRD',
  task: 'Task',
};

export const AGENT_ICONS: Record<AgentName, string> = {
  planner: '🎯',
  research: '🔍',
  product: '💡',
  prd: '📋',
  task: '📋',
};
