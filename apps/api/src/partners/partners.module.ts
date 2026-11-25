import { RoutingModule } from '../routing/routing.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { CommissionModule } from '../commission/commission.module.js';
import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service.js';
import { PartnersController } from './partners.controller.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { AuditLogModule } from '../audit-log/audit-log.module.js';
import { AadhaarService } from './aadhaar.service.js';
import { AadhaarController } from './aadhaar.controller.js';

@Module({
  imports: [RealtimeModule, NotificationsModule, MessagingModule, BookingsModule, CommissionModule, RoutingModule, AuditLogModule],
  providers: [PartnersService, AadhaarService],
  controllers: [PartnersController, AadhaarController],
  exports: [PartnersService, AadhaarService],
})
export class PartnersModule {}
