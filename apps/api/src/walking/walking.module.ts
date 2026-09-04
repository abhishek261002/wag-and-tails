import { Module } from '@nestjs/common';
import { WalkingService } from './walking.service.js';
import { WalkingController } from './walking.controller.js';
import { MapsLocationModule } from '../maps-location/maps-location.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [MapsLocationModule, NotificationsModule],
  providers: [WalkingService],
  controllers: [WalkingController],
  exports: [WalkingService],
})
export class WalkingModule {}
