import { Inject, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LLM_PROVIDER, type LLMProvider } from '../llm/llm.provider';
import { PrismaService } from '../prisma/prisma.service';

interface PendingStream {
  projectId: string;
  content: string;
}

@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly pendingStreams = new Map<string, PendingStream>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  onModuleDestroy() {
    this.pendingStreams.clear();
  }

  async createUserMessage(projectId: string, content: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const userMessage = await this.prisma.message.create({
      data: { projectId, role: 'user', content: content.trim() },
    });

    const streamId = randomUUID();
    this.pendingStreams.set(streamId, { projectId, content: content.trim() });

    return { userMessage, streamId };
  }

  listMessages(projectId: string) {
    return this.prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
  }

  /** Called by ChatController SSE when the client disconnects. */
  cancelStream(streamId: string) {
    this.pendingStreams.delete(streamId);
  }

  /** Returns the pending content for the given streamId, if still active. */
  getPendingContent(streamId: string): PendingStream | undefined {
    return this.pendingStreams.get(streamId);
  }

  /** Marks a stream as consumed (LLM response is complete). */
  consumeStream(streamId: string) {
    this.pendingStreams.delete(streamId);
  }

  /**
   * Streams the LLM response, calling onDelta for each token chunk.
   * Returns when the stream is complete.
   */
  async streamLlm(content: string, onDelta: (delta: string) => void): Promise<void> {
    await this.llm.stream(
      { messages: [{ role: 'user', content }] },
      onDelta,
    );
  }
}
