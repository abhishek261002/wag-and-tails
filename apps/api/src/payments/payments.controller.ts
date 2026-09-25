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
  @Roles('customer')
  createPaymentOrder(
    @CurrentUser() user: { sub: string },
    @Body() body: { bookingId?: string; orderId?: string }
  ) {
    return this.paymentsService.createPaymentOrder(body.bookingId ?? null, body.orderId ?? null, user.sub);
  }

  @Patch(':id/confirm')
  @Roles('customer')
  confirm(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: string },
    @Body() body: { method: string; providerPaymentId?: string; signature?: string }
  ) {
    return this.paymentsService.confirmPayment(user, id, body.method, body.providerPaymentId, body.signature);
  }

  @Post('bookings/:bookingId/pay-after-service')
  @Roles('customer')
  payAfterService(@Param('bookingId') bookingId: string, @CurrentUser() user: { sub: string }) {
    return this.paymentsService.confirmPayAfterService(user.sub, bookingId);
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
