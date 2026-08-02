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
