import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('projects/:projectId')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('messages')
  async createMessage(
    @Param('projectId') projectId: string,
    @Body() body: CreateMessageDto,
  ) {
    return this.chat.createUserMessage(projectId, body.content);
  }

  @Get('messages')
  listMessages(@Param('projectId') projectId: string) {
    return this.chat.listMessages(projectId);
  }

  /**
   * GET /projects/:projectId/chat/stream?streamId=...
   * Server-Sent Events endpoint for LLM chat streaming.
   * 1. Validates the streamId is still pending.
   * 2. Streams the LLM response back via SSE.
   * 3. Saves the assistant message to the DB on completion.
   */
  @Get('chat/stream')
  async chatStream(
    @Param('projectId') projectId: string,
    @Query('streamId') streamId: string,
    @Res() res: Response,
  ): Promise<void> {
    const pending = this.chat.getPendingContent(streamId);
    if (!pending || pending.projectId !== projectId) {
      throw new NotFoundException('Chat stream was not found or has expired');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: message.start\ndata: ${JSON.stringify({ streamId })}\n\n`);

    let fullContent = '';
    let errorOccurred = false;

    try {
      await this.chat.streamLlm(pending.content, (delta) => {
        fullContent += delta;
        res.write(
          `event: message.delta\ndata: ${JSON.stringify({ streamId, delta })}\n\n`,
        );
      });
    } catch (err) {
      errorOccurred = true;
      const message = err instanceof Error ? err.message : 'LLM streaming failed';
      res.write(
        `event: message.error\ndata: ${JSON.stringify({ streamId, message })}\n\n`,
      );
    }

    if (!errorOccurred) {
      // Save assistant message to DB
      try {
        const assistantMessage = await this.prisma.message.create({
          data: {
            projectId,
            role: 'assistant',
            content: fullContent,
          },
        });
        res.write(
          `event: message.complete\ndata: ${JSON.stringify({ streamId, message: assistantMessage })}\n\n`,
        );
      } catch {
        res.write(
          `event: message.error\ndata: ${JSON.stringify({ streamId, message: 'Failed to save response' })}\n\n`,
        );
      }
    }

    this.chat.consumeStream(streamId);
    res.end();
  }
}
