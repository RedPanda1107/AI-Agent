import { Inject, Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { LLM_PROVIDER, type LLMProvider, type LlmMessage } from '../llm/llm.provider';
import { PrismaService } from '../prisma/prisma.service';

interface PendingChat {
  projectId: string;
}

@Injectable()
export class ChatService {
  private readonly pendingStreams = new Map<string, PendingChat>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  async createUserMessage(projectId: string, content: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);

    const userMessage = await this.prisma.message.create({
      data: { projectId, role: 'user', content: content.trim() },
    });
    const streamId = randomUUID();
    this.pendingStreams.set(streamId, { projectId });
    return { userMessage, streamId };
  }

  listMessages(projectId: string) {
    return this.prisma.message.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  stream(projectId: string, streamId: string): Observable<MessageEvent> {
    const pending = this.pendingStreams.get(streamId);
    if (!pending || pending.projectId !== projectId) {
      throw new NotFoundException('Chat stream was not found or has expired');
    }

    return new Observable<MessageEvent>((subscriber) => {
      let cancelled = false;
      void this.runStream(projectId, streamId, subscriber, () => cancelled);
      return () => {
        cancelled = true;
      };
    });
  }

  private async runStream(
    projectId: string,
    streamId: string,
    subscriber: { next: (event: MessageEvent) => void; complete: () => void },
    isCancelled: () => boolean,
  ): Promise<void> {
    try {
      subscriber.next({ type: 'message.start', data: { streamId, role: 'assistant' } });
      const messages = await this.prisma.message.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      const history: LlmMessage[] = [
        { role: 'system', content: '你是一名专业、友好的产品经理助手。请用中文回答，帮助用户澄清并完善产品想法。' },
        ...messages.map((message) => ({ role: (message.role === 'assistant' ? 'assistant' : 'user') as import('../llm/llm.provider').LlmRole, content: message.content })),
      ];

      const result = await this.llm.stream({ messages: history }, (delta) => {
        if (!isCancelled()) subscriber.next({ type: 'message.delta', data: { streamId, delta } });
      });
      const assistantMessage = await this.prisma.message.create({
        data: { projectId, role: 'assistant', content: result.content },
      });
      if (!isCancelled()) {
        subscriber.next({ type: 'message.complete', data: { streamId, message: assistantMessage, model: result.model } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The chat request failed';
      if (!isCancelled()) subscriber.next({ type: 'message.error', data: { streamId, message } });
    } finally {
      this.pendingStreams.delete(streamId);
      if (!isCancelled()) subscriber.complete();
    }
  }
}
