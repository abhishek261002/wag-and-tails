import { Module } from '@nestjs/common';
import { PetsService } from './pets.service.js';
import { PetsController } from './pets.controller.js';

@Module({
  providers: [PetsService],
  controllers: [PetsController],
  exports: [PetsService],
})
export class PetsModule {}
