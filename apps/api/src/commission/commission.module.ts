import { Module } from '@nestjs/common';
import { CommissionService } from './commission.service.js';
import { CommissionAdminController, PartnerDuesController } from './commission.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditLogModule } from '../audit-log/audit-log.module.js';

@Module({
  imports: [PaymentsModule, NotificationsModule, AuditLogModule],
  providers: [CommissionService],
  controllers: [CommissionAdminController, PartnerDuesController],
  exports: [CommissionService],
})
export class CommissionModule {}
