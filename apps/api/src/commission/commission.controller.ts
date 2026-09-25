import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommissionService, type Actor } from './commission.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

// Partner-facing: my commission account.
@ApiTags('partner')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('partner')
@Controller('partner/dues')
export class PartnerDuesController {
  constructor(private commission: CommissionService) {}

  @Get()
  async status(@CurrentUser() user: { sub: string }) {
    return this.commission.getDuesStatus(user.sub);
  }

  @Post('pay-order')
  payOrder(@CurrentUser() user: { sub: string }, @Body() body: { amount?: number }) {
    return this.commission.createDuesOrder(user.sub, body?.amount);
  }

  @Post('pay-confirm')
  payConfirm(
    @CurrentUser() user: { sub: string },
    @Body() body: { commissionPaymentId?: string; providerPaymentId?: string; signature?: string }
  ) {
    return this.commission.confirmDuesPayment(user.sub, body ?? {});
  }
}

// Staff and admin: settings, per-partner commission, discounts, dues.
@ApiTags('commission')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('commission')
export class CommissionAdminController {
  constructor(private commission: CommissionService) {}

  @Get('settings')
  @Roles('staff', 'admin')
  getSettings() {
    return this.commission.getSettings();
  }

  @Put('settings')
  @Roles('admin')
  updateSettings(@CurrentUser() user: Actor, @Body() body: Record<string, unknown>) {
    return this.commission.updateSettings(user, body);
  }

  @Get('partners/:id')
  @Roles('staff', 'admin')
  overview(@Param('id', ParseUUIDPipe) id: string) {
    return this.commission.getPartnerOverview(id);
  }

  @Patch('partners/:id')
  @Roles('staff', 'admin')
  setCommission(@CurrentUser() user: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.commission.setPartnerCommission(user, id, body);
  }

  @Post('partners/:id/discounts')
  @Roles('staff', 'admin')
  createDiscount(@CurrentUser() user: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.commission.createDiscount(user, id, body);
  }

  @Patch('discounts/:id')
  @Roles('staff', 'admin')
  updateDiscount(@CurrentUser() user: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.commission.updateDiscount(user, id, body);
  }

  @Post('partners/:id/dues/offline')
  @Roles('admin')
  offline(@CurrentUser() user: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.commission.recordOfflinePayment(user, id, body);
  }

  @Post('partners/:id/dues/adjust')
  @Roles('admin')
  adjust(@CurrentUser() user: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.commission.adjust(user, id, body);
  }

  @Post('reconcile')
  @Roles('admin')
  reconcile() {
    return this.commission.reconcile();
  }
}
