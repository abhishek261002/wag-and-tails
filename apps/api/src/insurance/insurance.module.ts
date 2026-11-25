import { Module } from '@nestjs/common';
import { InsuranceService } from './insurance.service.js';
import { InsuranceController } from './insurance.controller.js';

@Module({
  providers: [InsuranceService],
  exports: [InsuranceService],
  controllers: [InsuranceController],
})
export class InsuranceModule {}
