import { Module } from '@nestjs/common';
import { MapsLocationService } from './maps-location.service.js';
import { MapsController } from './maps.controller.js';

@Module({
  providers: [MapsLocationService],
  controllers: [MapsController],
  exports: [MapsLocationService],
})
export class MapsLocationModule {}
