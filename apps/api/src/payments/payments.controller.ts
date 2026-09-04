import { Controller, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('orders')
  @Roles('customer', 'partner')
  createPaymentOrder(
    @CurrentUser() user: { sub: string },
    @Body() body: { bookingId?: string; orderId?: string; amount: number }
  ) {
    return this.paymentsService.createPaymentOrder(
      body.bookingId ?? null,
      body.orderId ?? null,
      user.sub,
      body.amount
    );
  }

  @Patch(':id/confirm')
  @Roles('customer', 'partner', 'staff', 'admin')
  confirm(
    @Param('id') id: string,
    @Body() body: { method: string; providerPaymentId?: string }
  ) {
    return this.paymentsService.confirmPayment(id, body.method, body.providerPaymentId);
  }

  @Post(':id/refund')
  @Roles('staff', 'admin')
  refund(
    @Param('id') id: string,
    @Body() body: { amount: number; reason: string }
  ) {
    return this.paymentsService.refund(id, body.amount, body.reason);
  }
}
