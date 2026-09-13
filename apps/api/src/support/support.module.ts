import { Module } from '@nestjs/common';
import { SupportService } from './support.service.js';
import { SupportController } from './support.controller.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [RealtimeModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
