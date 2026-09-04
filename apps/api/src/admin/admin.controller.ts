import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { PartnersService } from '../partners/partners.service.js';
import { PayoutsService } from '../payouts/payouts.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private partnersService: PartnersService,
    private payoutsService: PayoutsService,
    private couponsService: CouponsService
  ) {}

  @Get('dashboard')
  getDashboard() { return this.adminService.getDashboardKpis(); }

  @Get('audit-logs')
  getAuditLogs(@Query() query: any) { return this.adminService.getAuditLogs(query); }

  // Partners
  @Get('partners')
  listPartners(@Query() query: any) { return this.partnersService.listAll(query); }

  @Patch('partners/:id/approve')
  approvePartner(@Param('id') id: string, @Body() body: { adminId: string }) {
    return this.partnersService.approve(id, body.adminId);
  }

  @Patch('partners/:id/suspend')
  suspendPartner(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.partnersService.suspend(id, body.reason);
  }

  // Payouts
  @Get('payouts')
  listPayouts(@Query() query: any) { return this.payoutsService.listAll(query); }

  @Post('payouts/batch')
  approveBatch(@Body() body: { payoutIds: string[]; adminId: string }) {
    return this.payoutsService.approveBatch(body.payoutIds, body.adminId);
  }

  @Patch('payouts/batches/:id/pay')
  markBatchPaid(@Param('id') id: string) {
    return this.payoutsService.markPaid(id);
  }

  // Coupons
  @Get('coupons')
  listCoupons() { return this.couponsService.list(); }

  @Post('coupons')
  createCoupon(@Body() body: any) { return this.couponsService.create(body); }

  @Patch('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() body: any) {
    return this.couponsService.update(id, body);
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string) { return this.couponsService.delete(id); }

  // Products
  @Post('products')
  createProduct(@Body() body: any) { return this.adminService.manageProduct(body); }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateProduct(id, body);
  }

  // Walk pricing
  @Patch('walk-pricing/:id')
  updateWalkPricing(@Param('id') id: string, @Body() body: { price: number }) {
    return this.adminService.updateWalkPricing(id, body.price);
  }

  // Staff users
  @Post('staff')
  createStaff(@Body() body: any) {
    return this.adminService.manageStaffUser('create', body);
  }
}
