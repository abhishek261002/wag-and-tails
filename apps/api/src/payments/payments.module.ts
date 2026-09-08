import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { MapsLocationModule } from '../maps-location/maps-location.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [MapsLocationModule, RealtimeModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
