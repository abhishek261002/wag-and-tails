import { Module } from '@nestjs/common';
import { AiPetChatService } from './ai-pet-chat.service.js';
import { AiPetChatController } from './ai-pet-chat.controller.js';

@Module({
  providers: [AiPetChatService],
  controllers: [AiPetChatController],
})
export class AiPetChatModule {}
