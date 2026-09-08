import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service.js';
import { PartnersController } from './partners.controller.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  providers: [PartnersService],
  controllers: [PartnersController],
  exports: [PartnersService],
})
export class PartnersModule {}
