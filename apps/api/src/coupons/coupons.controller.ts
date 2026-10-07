import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('coupons')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('coupons')
export class CouponsController {
  constructor(private couponsService: CouponsService) {}

  @Post('apply')
  @Roles('customer', 'partner', 'staff', 'admin')
  apply(
    @Body() body: { couponCode: string; service: string; orderValue: number },
    @CurrentUser() user: { sub: string }
  ) {
    return this.couponsService.apply(body.couponCode, body.service, body.orderValue, user.sub);
  }

  /** Coupons for the checkout screen, each with its saving for this order or why it can't be used. */
  @Get('available')
  @Roles('customer')
  available(@Query('service') service: string, @Query('orderValue') orderValue: string, @CurrentUser() user: { sub: string }) {
    return this.couponsService.listAvailable(service, orderValue, user.sub);
  }

  @Get('active')
  @Roles('customer', 'partner', 'staff', 'admin')
  listActive() { return this.couponsService.listActive(); }

  @Get()
  @Roles('admin', 'staff')
  list() { return this.couponsService.list(); }

  @Post()
  @Roles('admin')
  create(@Body() body: any) { return this.couponsService.create(body); }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() body: any) {
    return this.couponsService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: string) { return this.couponsService.delete(id); }
}
