import type { ChatMessage } from './chat.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function getMessages(projectId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/messages`);
  if (!response.ok) throw new Error('无法加载历史消息');
  return response.json() as Promise<ChatMessage[]>;
}

export async function createMessage(projectId: string, content: string): Promise<{ userMessage: ChatMessage; streamId: string }> {
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
  return new EventSource(`${API_BASE_URL}/projects/${projectId}/chat/stream?streamId=${encodeURIComponent(streamId)}`);
}
