import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiPetChatService } from './ai-pet-chat.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('ai-pet-chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('ai')
export class AiPetChatController {
  constructor(private aiService: AiPetChatService) {}

  @Post('pet-chat')
  @Roles('customer')
  chat(
    @CurrentUser() user: { sub: string },
    @Body() body: { petId: string; message: string; sessionId?: string }
  ) {
    return this.aiService.chat(user.sub, body.petId, body.message, body.sessionId);
  }

  @Get('sessions')
  @Roles('customer')
  getSessions(
    @CurrentUser() user: { sub: string },
    @Query('petId') petId: string
  ) {
    return this.aiService.getSessions(user.sub, petId);
  }

  @Get('sessions/:id/messages')
  @Roles('customer')
  getMessages(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string }
  ) {
    return this.aiService.getSessionMessages(id, user.sub);
  }
}
