import { create } from 'zustand';
import type { ChatMessage, StreamState } from './chat.types';

interface ChatStore extends StreamState {
  currentProjectId: string | null;
  messages: ChatMessage[];
  setProject: (projectId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  startStream: (streamId: string) => void;
  appendDelta: (streamId: string, delta: string) => void;
  completeStream: (streamId: string, message: ChatMessage) => void;
  failStream: (message: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  currentProjectId: null,
  messages: [],
  streamId: null,
  isStreaming: false,
  error: null,
  setProject: (projectId) => set({ currentProjectId: projectId, messages: [], streamId: null, isStreaming: false, error: null }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  startStream: (streamId) => set((state) => ({
    streamId,
    isStreaming: true,
    error: null,
    messages: [...state.messages, { id: streamId, role: 'assistant', content: '', createdAt: new Date().toISOString() }],
  })),
  appendDelta: (streamId, delta) => set((state) => ({
    messages: state.messages.map((message) => message.id === streamId ? { ...message, content: message.content + delta } : message),
  })),
  completeStream: (streamId, message) => set((state) => ({
    isStreaming: false,
    streamId: null,
    messages: state.messages.map((item) => item.id === streamId ? message : item),
  })),
  failStream: (error) => set({ isStreaming: false, streamId: null, error }),
}));
