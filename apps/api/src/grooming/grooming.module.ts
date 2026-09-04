import { Module } from '@nestjs/common';
import { GroomingService } from './grooming.service.js';
import { GroomingController } from './grooming.controller.js';

@Module({
  providers: [GroomingService],
  controllers: [GroomingController],
  exports: [GroomingService],
})
export class GroomingModule {}
