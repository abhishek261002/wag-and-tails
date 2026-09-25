import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser } from '../common/decorators.js';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string }, @Query('limit') limit?: string, @Query('before') before?: string) {
    return this.notificationsService.getUserNotifications(user.sub, { limit: limit ? Number(limit) : undefined, before });
  }

  @Get('unread-count')
  unread(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Get('preferences')
  prefs(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Put('preferences')
  updatePrefs(@CurrentUser() user: { sub: string }, @Body() body: { reminders?: boolean; tips?: boolean }) {
    return this.notificationsService.updatePreferences(user.sub, body ?? {});
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { sub: string }) {
    return this.notificationsService.markRead(id, user.sub);
  }
}
