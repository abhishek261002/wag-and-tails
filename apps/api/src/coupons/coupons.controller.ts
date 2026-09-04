import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
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
