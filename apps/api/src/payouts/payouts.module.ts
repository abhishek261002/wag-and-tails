import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service.js';
import { PayoutsController } from './payouts.controller.js';

@Module({
  providers: [PayoutsService],
  controllers: [PayoutsController],
  exports: [PayoutsService],
})
export class PayoutsModule {}
