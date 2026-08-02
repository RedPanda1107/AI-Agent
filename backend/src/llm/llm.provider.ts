export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmGenerateRequest {
  messages: LlmMessage[];
  temperature?: number;
}

export interface LlmGenerateResponse {
  content: string;
  model: string;
  tokenUsage?: number;
}

export interface LLMProvider {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
  stream(request: LlmGenerateRequest, onDelta: (delta: string) => void): Promise<LlmGenerateResponse>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
