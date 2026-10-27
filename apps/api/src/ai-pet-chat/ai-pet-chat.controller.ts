import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
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

  /** Dr. Woof: one assistant with the context of all of the customer's pets. */
  @Post('dr-woof')
  @Roles('customer')
  drWoof(@CurrentUser() user: { sub: string }, @Body() body: { message?: unknown; sessionId?: unknown; imageUrl?: unknown }) {
    return this.aiService.drWoofChat(user.sub, body?.message, body?.sessionId, body?.imageUrl);
  }

  /** What the app may offer in the chat (photos are a server switch). */
  @Get('dr-woof/config')
  @Roles('customer')
  drWoofConfig() {
    return this.aiService.drWoofConfig();
  }

  @Delete('dr-woof/sessions/:id')
  @Roles('customer')
  deleteDrWoofSession(@CurrentUser() user: { sub: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.deleteDrWoofSession(user.sub, id);
  }

  @Get('dr-woof/sessions')
  @Roles('customer')
  drWoofSessions(@CurrentUser() user: { sub: string }) {
    return this.aiService.drWoofSessions(user.sub);
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
