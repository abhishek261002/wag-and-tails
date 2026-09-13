import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service.js';
import { MessagingController } from './messaging.controller.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [RealtimeModule],
  providers: [MessagingService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
