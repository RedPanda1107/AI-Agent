import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LLMProvider, LlmGenerateRequest, LlmGenerateResponse } from './llm.provider';

interface KimiChunk {
  choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
  usage?: { total_tokens?: number };
  model?: string;
}

@Injectable()
export class KimiProvider implements LLMProvider {
  constructor(private readonly config: ConfigService) {}

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    let content = '';
    return this.stream(request, (delta) => {
      content += delta;
    }).then((result) => ({ ...result, content }));
  }

  async stream(request: LlmGenerateRequest, onDelta: (delta: string) => void): Promise<LlmGenerateResponse> {
    const apiKey = this.config.get<string>('KIMI_API_KEY');
    const baseUrl = this.config.get<string>('KIMI_BASE_URL') ?? 'https://api.moonshot.cn/v1';
    const model = this.config.get<string>('KIMI_MODEL');

    if (!apiKey || !model) {
      throw new ServiceUnavailableException('Kimi is not configured. Set KIMI_API_KEY and KIMI_MODEL in backend/.env.');
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: request.messages, temperature: request.temperature ?? 0.7, stream: true }),
    });

    if (!response.ok || !response.body) {
      const details = await response.text();
      throw new ServiceUnavailableException(`Kimi request failed (${response.status}): ${details.slice(0, 500)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let tokenUsage: number | undefined;
    let responseModel = model;

    const consumeLine = (line: string): boolean => {
      if (!line.startsWith('data:')) return false;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return true;
      try {
        const chunk = JSON.parse(data) as KimiChunk;
        const delta = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? '';
        if (delta) {
          content += delta;
          onDelta(delta);
        }
        tokenUsage = chunk.usage?.total_tokens ?? tokenUsage;
        responseModel = chunk.model ?? responseModel;
      } catch {
        // Ignore non-JSON SSE keepalive lines.
      }
      return false;
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      if (lines.some(consumeLine) || done) break;
    }
    if (buffer) consumeLine(buffer);

    return { content, model: responseModel, tokenUsage };
  }
}
