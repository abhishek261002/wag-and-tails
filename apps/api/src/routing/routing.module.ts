import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service.js';
import { TrackingService } from './tracking.service.js';

@Module({
  providers: [RoutingService, TrackingService],
  exports: [RoutingService, TrackingService],
})
export class RoutingModule {}
