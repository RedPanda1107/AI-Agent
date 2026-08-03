import { create } from 'zustand';
import type { ChatMessage, StreamState, WorkflowEvent, NodeResult, AgentName } from './chat.types';

type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed';

interface NodeState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: unknown;
}

interface ChatStore extends StreamState {
  currentProjectId: string | null;
  messages: ChatMessage[];
  setProject: (projectId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  startStream: (streamId: string) => void;
  appendDelta: (streamId: string, delta: string) => void;
  completeStream: (streamId: string, message: ChatMessage) => void;
  failStream: (message: string) => void;

  // Workflow state
  workflowRunId: string | null;
  workflowStatus: WorkflowStatus;
  nodeStates: Record<AgentName, NodeState>;
  workflowResults: NodeResult;
  workflowError: string | null;

  // Workflow actions
  startWorkflow: (runId: string) => void;
  handleWorkflowEvent: (event: WorkflowEvent) => void;
  resetWorkflow: () => void;
}

const initialNodeStates: Record<AgentName, NodeState> = {
  planner: { status: 'pending', output: null },
  research: { status: 'pending', output: null },
  product: { status: 'pending', output: null },
  prd: { status: 'pending', output: null },
  task: { status: 'pending', output: null },
};

export const useChatStore = create<ChatStore>((set) => ({
  currentProjectId: null,
  messages: [],
  streamId: null,
  isStreaming: false,
  error: null,

  setProject: (projectId) =>
    set({ currentProjectId: projectId, messages: [], streamId: null, isStreaming: false, error: null }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  startStream: (streamId) =>
    set((state) => ({
      streamId,
      isStreaming: true,
      error: null,
      messages: [
        ...state.messages,
        { id: streamId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
      ],
    })),

  appendDelta: (streamId, delta) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === streamId ? { ...m, content: m.content + delta } : m,
      ),
    })),

  completeStream: (streamId, message) =>
    set((state) => ({
      isStreaming: false,
      streamId: null,
      messages: state.messages.map((m) => (m.id === streamId ? message : m)),
    })),

  failStream: (error) => set({ isStreaming: false, streamId: null, error }),

  // --- Workflow ---
  workflowRunId: null,
  workflowStatus: 'idle',
  nodeStates: { ...initialNodeStates },
  workflowResults: {},
  workflowError: null,

  startWorkflow: (runId) =>
    set({
      workflowRunId: runId,
      workflowStatus: 'running',
      workflowError: null,
      nodeStates: { ...initialNodeStates },
      workflowResults: {},
    }),

  handleWorkflowEvent: (event) =>
    set((state) => {
      if (event.type === 'run.started') {
        return { workflowStatus: 'running', workflowError: null };
      }

      if (event.type === 'node.started' && event.node) {
        const nodeName = event.node as AgentName;
        if (nodeName in state.nodeStates) {
          return {
            nodeStates: {
              ...state.nodeStates,
              [nodeName]: { ...state.nodeStates[nodeName], status: 'running' },
            },
          };
        }
      }

      if (event.type === 'node.delta' && event.node && event.data) {
        const nodeName = event.node as AgentName;
        if (nodeName in state.nodeStates) {
          const prevOutput = (state.nodeStates[nodeName].output as Record<string, unknown>) ?? {};
          return {
            workflowResults: {
              ...state.workflowResults,
              [nodeName]: { ...prevOutput, ...(event.data as Record<string, unknown>) },
            },
            nodeStates: {
              ...state.nodeStates,
              [nodeName]: {
                status: 'completed',
                output: { ...prevOutput, ...(event.data as Record<string, unknown>) },
              },
            },
          };
        }
      }

      if (event.type === 'node.completed' && event.node) {
        const nodeName = event.node as AgentName;
        if (nodeName in state.nodeStates) {
          return {
            nodeStates: {
              ...state.nodeStates,
              [nodeName]: {
                status: 'completed',
                output: event.data ?? state.nodeStates[nodeName].output,
              },
            },
          };
        }
      }

      if (event.type === 'node.failed' && event.node) {
        const nodeName = event.node as AgentName;
        if (nodeName in state.nodeStates) {
          return {
            workflowStatus: 'failed',
            workflowError: (event.data as { message?: string })?.message ?? '未知错误',
            nodeStates: {
              ...state.nodeStates,
              [nodeName]: { status: 'failed', output: event.data },
            },
          };
        }
      }

      if (event.type === 'run.completed') {
        return { workflowStatus: state.workflowStatus === 'failed' ? 'failed' : 'completed' };
      }

      return state;
    }),

  resetWorkflow: () =>
    set({
      workflowRunId: null,
      workflowStatus: 'idle',
      nodeStates: { ...initialNodeStates },
      workflowResults: {},
      workflowError: null,
    }),
}));
