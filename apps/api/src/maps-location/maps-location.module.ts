import { Module } from '@nestjs/common';
import { MapsLocationService } from './maps-location.service.js';

@Module({
  providers: [MapsLocationService],
  exports: [MapsLocationService],
})
export class MapsLocationModule {}
