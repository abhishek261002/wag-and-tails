import { Module } from '@nestjs/common';
import { PartnersModule } from '../partners/partners.module.js';
import { CommissionModule } from '../commission/commission.module.js';
import { PayoutsModule } from '../payouts/payouts.module.js';
import { SupportModule } from '../support/support.module.js';
import { AuditLogModule } from '../audit-log/audit-log.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PanelService } from './panel.service.js';
import { PanelController } from './panel.controller.js';

// The website plugin is the only panel (admin web and staff web retired, 25 Nov 2026).
@Module({
  imports: [PartnersModule, CommissionModule, PayoutsModule, SupportModule, AuditLogModule, NotificationsModule],
  providers: [PanelService],
  controllers: [PanelController],
})
export class PanelModule {}
