import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('staff', 'admin')
@Controller('staff')
export class StaffController {
  constructor(
    private staffService: StaffService,
    private bookingsService: BookingsService,
    private ordersService: OrdersService
  ) {}

  @Get('dashboard')
  getDashboard() { return this.staffService.getDashboardKpis(); }

  @Post('bookings')
  createBooking(@CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.staffService.createBookingForCustomer(user.sub, body);
  }

  @Get('bookings')
  listBookings(@Query() query: any) {
    return this.bookingsService.listAll(query);
  }

  @Patch('bookings/:id/assign')
  assignPartner(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { partnerId: string }
  ) {
    return this.staffService.assignPartner(id, body.partnerId, user.sub);
  }

  @Patch('bookings/:id/unassign')
  unassignPartner(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.staffService.unassignPartner(id, user.sub);
  }

  @Patch('bookings/:id/cancel')
  cancelBooking(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { reason?: string }
  ) {
    return this.bookingsService.cancel(id, user.sub, 'staff', body.reason);
  }

  @Get('customers')
  listCustomers(@Query() query: any) {
    return this.staffService.listCustomers(query);
  }

  @Get('orders')
  listOrders(@Query() query: any) {
    return this.ordersService.listAll(query);
  }

  @Patch('orders/:id/pack')
  packOrder(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.ordersService.markPacked(id, user.sub);
  }
}
