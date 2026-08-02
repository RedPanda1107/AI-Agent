import { Body, Controller, Get, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatService } from './chat.service';

@Controller('projects/:projectId')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('messages')
  createMessage(@Param('projectId') projectId: string, @Body() body: CreateMessageDto) {
    return this.chat.createUserMessage(projectId, body.content);
  }

  @Get('messages')
  listMessages(@Param('projectId') projectId: string) {
    return this.chat.listMessages(projectId);
  }

  @Sse('chat/stream')
  stream(
    @Param('projectId') projectId: string,
    @Query('streamId') streamId: string,
  ): Observable<MessageEvent> {
    return this.chat.stream(projectId, streamId);
  }
}
