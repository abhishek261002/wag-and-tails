import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post()
  @Roles('customer', 'partner', 'staff', 'admin')
  create(
    @CurrentUser() user: { sub: string },
    @Body() body: { subject: string; description: string }
  ) {
    return this.supportService.create(user.sub, body.subject, body.description);
  }

  @Get()
  @Roles('customer', 'partner', 'staff', 'admin')
  list(
    @CurrentUser() user: { sub: string; role: string },
    @Query('status') status?: string,
    @Query('escalated') escalated?: string
  ) {
    if (user.role === 'staff' || user.role === 'admin') {
      return this.supportService.listAll({
        status,
        escalated: escalated === undefined ? undefined : escalated === 'true',
      });
    }
    return this.supportService.listByUser(user.sub);
  }

  @Get(':id')
  @Roles('customer', 'partner', 'staff', 'admin')
  getOne(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }) {
    return this.supportService.getOne(id, user.sub, user.role);
  }

  @Patch(':id/status')
  @Roles('staff', 'admin')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.supportService.updateStatus(id, body.status);
  }

  @Patch(':id/escalate')
  @Roles('staff', 'admin')
  escalate(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { reason: string }
  ) {
    return this.supportService.escalate(id, user.sub, body.reason);
  }

  @Post(':id/conversation')
  @Roles('customer', 'partner', 'staff', 'admin')
  getOrCreateConversation(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }) {
    return this.supportService.getOrCreateConversation(id, user.sub, user.role);
  }

  @Get(':id/messages')
  @Roles('customer', 'partner', 'staff', 'admin')
  getMessages(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }) {
    return this.supportService.getMessages(id, user.sub, user.role);
  }

  @Post(':id/messages')
  @Roles('customer', 'partner', 'staff', 'admin')
  sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: string },
    @Body() body: { content: string; attachmentUrl?: string; attachmentType?: string }
  ) {
    return this.supportService.sendMessage(id, user.sub, user.role, body.content, body.attachmentUrl, body.attachmentType);
  }
}
