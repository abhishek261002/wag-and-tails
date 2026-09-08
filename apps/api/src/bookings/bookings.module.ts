import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { BookingsController } from './bookings.controller.js';
import { CouponsModule } from '../coupons/coupons.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [CouponsModule, RealtimeModule],
  providers: [BookingsService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
