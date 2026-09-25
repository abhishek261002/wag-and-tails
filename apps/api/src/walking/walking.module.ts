import { Module } from '@nestjs/common';
import { WalkingService } from './walking.service.js';
import { WalkingController } from './walking.controller.js';
import { MapsLocationModule } from '../maps-location/maps-location.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { CommissionModule } from '../commission/commission.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';

@Module({
  imports: [MapsLocationModule, NotificationsModule, RealtimeModule, MessagingModule, BookingsModule, CommissionModule],
  providers: [WalkingService],
  controllers: [WalkingController],
  exports: [WalkingService],
})
export class WalkingModule {}
