import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StoreService } from './store.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('store')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('store')
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Get('categories')
  @Roles('customer', 'partner', 'staff', 'admin')
  listCategories() { return this.storeService.listCategories(); }

  @Get('products')
  @Roles('customer', 'partner', 'staff', 'admin')
  listProducts(@Query() query: any) { return this.storeService.listProducts(query); }

  @Get('products/:id')
  @Roles('customer', 'partner', 'staff', 'admin')
  getProduct(@Param('id') id: string) { return this.storeService.getProduct(id); }

  @Get('cart')
  @Roles('customer', 'partner')
  getCart(@CurrentUser() user: { sub: string }) {
    return this.storeService.getOrCreateCart(user.sub);
  }

  @Post('cart/items')
  @Roles('customer', 'partner')
  addToCart(
    @CurrentUser() user: { sub: string; role: string },
    @Body() body: { productId: string; variantId?: string; quantity: number }
  ) {
    const isTradeUser = user.role === 'partner';
    return this.storeService.addToCart(user.sub, body.productId, body.quantity, body.variantId, isTradeUser);
  }

  @Patch('cart/items/:itemId')
  @Roles('customer', 'partner')
  updateCartItem(
    @CurrentUser() user: { sub: string },
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number }
  ) {
    return this.storeService.updateCartItem(user.sub, itemId, body.quantity);
  }

  @Post('cart/coupon')
  @Roles('customer', 'partner')
  applyCoupon(@CurrentUser() user: { sub: string }, @Body() body: { couponCode: string }) {
    return this.storeService.applyCoupon(user.sub, body.couponCode);
  }

  @Post('orders')
  @Roles('customer', 'partner')
  checkout(
    @CurrentUser() user: { sub: string },
    @Body() body: { addressId: string; paymentMethod: string; couponCode?: string }
  ) {
    return this.storeService.checkout(user.sub, body.addressId, body.paymentMethod, body.couponCode);
  }
}
