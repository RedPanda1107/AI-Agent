import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({ imports: [LlmModule, PrismaModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
