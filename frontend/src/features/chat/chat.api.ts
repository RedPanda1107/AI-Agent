import type { ChatMessage } from './chat.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// --- Chat / Message APIs ---

export async function getMessages(projectId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/messages`);
  if (!response.ok) throw new Error('无法加载历史消息');
  return response.json() as Promise<ChatMessage[]>;
}

export async function createMessage(
  projectId: string,
  content: string,
): Promise<{ userMessage: ChatMessage; streamId: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || '发送消息失败');
  }
  return response.json() as Promise<{ userMessage: ChatMessage; streamId: string }>;
}

export function openStream(projectId: string, streamId: string): EventSource {
  return new EventSource(
    `${API_BASE_URL}/projects/${projectId}/chat/stream?streamId=${encodeURIComponent(streamId)}`,
  );
}

// --- Workflow APIs ---

export interface WorkflowStartResponse {
  runId: string;
  projectId: string;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  status: string;
  currentNode: string | null;
  createdAt: string;
  updatedAt: string;
  agentRuns?: WorkflowAgentRun[];
}

export interface WorkflowAgentRun {
  id: string;
  workflowRunId: string;
  agentName: string;
  status: string;
  input: unknown;
  output: unknown;
  durationMs: number | null;
  tokenUsage: number | null;
  createdAt: string;
}

export interface WorkflowStartRequest {
  projectId: string;
  idea: string;
}

export async function startWorkflow(req: WorkflowStartRequest): Promise<WorkflowStartResponse> {
  const response = await fetch(`${API_BASE_URL}/workflow/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || '启动工作流失败');
  }
  return response.json() as Promise<WorkflowStartResponse>;
}

export function openWorkflowStream(runId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/workflow/run/${runId}/stream`);
}

export async function getWorkflowRun(runId: string): Promise<WorkflowRun | { error: string }> {
  const response = await fetch(`${API_BASE_URL}/workflow/run/${runId}`);
  if (!response.ok) throw new Error('获取工作流状态失败');
  return response.json() as Promise<WorkflowRun | { error: string }>;
}

export async function getWorkflowResults(
  runId: string,
): Promise<Record<string, unknown> | { error: string }> {
  const response = await fetch(`${API_BASE_URL}/workflow/run/${runId}/results`);
  if (!response.ok) throw new Error('获取工作流结果失败');
  return response.json() as Promise<Record<string, unknown> | { error: string }>;
}
