import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('payouts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('partner/payouts')
export class PayoutsController {
  constructor(private payoutsService: PayoutsService) {}

  @Get()
  @Roles('partner')
  list(@CurrentUser() user: { sub: string }) {
    return this.payoutsService.listByPartner(user.sub);
  }

  @Post('request')
  @Roles('partner')
  request(@CurrentUser() user: { sub: string }, @Body() body: { amount: number }) {
    return this.payoutsService.requestPayout(user.sub, body.amount);
  }
}
