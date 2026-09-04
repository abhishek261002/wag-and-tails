import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { PartnersModule } from '../partners/partners.module.js';
import { PayoutsModule } from '../payouts/payouts.module.js';
import { CouponsModule } from '../coupons/coupons.module.js';

@Module({
  imports: [PartnersModule, PayoutsModule, CouponsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
