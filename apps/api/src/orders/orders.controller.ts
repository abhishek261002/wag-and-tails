import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('store-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('store/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @Roles('customer', 'partner', 'staff', 'admin')
  list(@CurrentUser() user: { sub: string; role: string }, @Query() query: any) {
    if (user.role === 'customer' || user.role === 'partner') {
      return this.ordersService.listByUser(user.sub);
    }
    return this.ordersService.listAll(query);
  }

  @Get(':id')
  @Roles('customer', 'partner', 'staff', 'admin')
  getById(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }) {
    return this.ordersService.getById(id, user.sub, user.role);
  }

  @Patch(':id/pack')
  @Roles('staff', 'admin')
  markPacked(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.ordersService.markPacked(id, user.sub);
  }

  @Patch(':id/status')
  @Roles('staff', 'admin')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.ordersService.updateStatus(id, body.status);
  }
}
