import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service.js';
import { RemindersController } from './reminders.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  providers: [RemindersService],
  controllers: [RemindersController],
})
export class RemindersModule {}
