import { Module } from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { StaffController } from './staff.controller.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { PartnersModule } from '../partners/partners.module.js';
import { OrdersModule } from '../orders/orders.module.js';

@Module({
  imports: [BookingsModule, PartnersModule, OrdersModule],
  providers: [StaffService],
  controllers: [StaffController],
  exports: [StaffService],
})
export class StaffModule {}
