import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get()
  @Roles('customer', 'staff', 'admin')
  list(@CurrentUser() user: { sub: string; role: string }, @Query() query: any) {
    if (user.role === 'customer') {
      return this.bookingsService.listByCustomer(user.sub, query);
    }
    return this.bookingsService.listAll(query);
  }

  @Get(':id')
  @Roles('customer', 'partner', 'staff', 'admin')
  get(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }) {
    return this.bookingsService.getById(id, user.sub, user.role);
  }

  @Get(':id/history')
  @Roles('customer', 'partner', 'staff', 'admin')
  getHistory(@Param('id') id: string) {
    return this.bookingsService.getHistory(id);
  }

  @Post('grooming')
  @Roles('customer')
  createGrooming(@CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.bookingsService.createGroomingBooking(user.sub, body);
  }

  @Post('walking')
  @Roles('customer')
  createWalking(@CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.bookingsService.createWalkingBooking(user.sub, body);
  }

  @Patch(':id/reschedule')
  @Roles('customer', 'staff', 'admin')
  reschedule(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { scheduledAt: string; reason?: string }
  ) {
    return this.bookingsService.reschedule(id, user.sub, body.scheduledAt, body.reason);
  }

  @Patch(':id/cancel')
  @Roles('customer', 'staff', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: string },
    @Body() body: { reason?: string }
  ) {
    return this.bookingsService.cancel(id, user.sub, user.role, body.reason);
  }
}
