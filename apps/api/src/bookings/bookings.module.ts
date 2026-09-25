import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { BookingsController } from './bookings.controller.js';
import { CouponsModule } from '../coupons/coupons.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RoutingModule } from '../routing/routing.module.js';
import { DispatchService } from './dispatch.service.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [CouponsModule, RealtimeModule, NotificationsModule, RoutingModule],
  providers: [BookingsService, DispatchService],
  controllers: [BookingsController],
  exports: [BookingsService, DispatchService],
})
export class BookingsModule {}
