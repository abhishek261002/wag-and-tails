import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('messaging')
export class MessagingController {
  constructor(private messagingService: MessagingService) {}

  @Get('conversations')
  @Roles('customer', 'partner', 'staff', 'admin')
  list(@CurrentUser() user: { sub: string }) {
    return this.messagingService.listConversations(user.sub);
  }

  @Post('conversations')
  @Roles('customer', 'partner', 'staff', 'admin')
  getOrCreate(
    @CurrentUser() user: { sub: string },
    @Body() body: { bookingId: string }
  ) {
    return this.messagingService.getOrCreateConversation(body.bookingId, user.sub);
  }

  @Get('conversations/:id/messages')
  @Roles('customer', 'partner', 'staff', 'admin')
  getMessages(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Query('before') before?: string
  ) {
    return this.messagingService.getMessages(id, user.sub, before);
  }

  @Post('conversations/:id/messages')
  @Roles('customer', 'partner', 'staff', 'admin')
  sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: string },
    @Body() body: { content: string; attachmentUrl?: string }
  ) {
    return this.messagingService.sendMessage(id, user.sub, user.role, body.content, body.attachmentUrl);
  }

  @Patch('conversations/:id/read')
  @Roles('customer', 'partner', 'staff', 'admin')
  markRead(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.messagingService.markRead(id, user.sub);
  }
}
