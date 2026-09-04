import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GroomingService } from './grooming.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('grooming')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('grooming')
export class GroomingController {
  constructor(private groomingService: GroomingService) {}

  @Get('packages')
  @Roles('customer', 'partner', 'staff', 'admin')
  getPackages() { return this.groomingService.getPackages(); }

  @Get('packages/:id')
  @Roles('customer', 'partner', 'staff', 'admin')
  getPackage(@Param('id') id: string) { return this.groomingService.getPackage(id); }

  @Get('add-ons')
  @Roles('customer', 'partner', 'staff', 'admin')
  getAddOns() { return this.groomingService.getAddOns(); }

  @Get('slots')
  @Roles('customer', 'staff', 'admin')
  getSlots(
    @Query('packageId') packageId: string,
    @Query('date') date: string,
    @Query('addressId') addressId: string
  ) {
    return this.groomingService.getAvailableSlots(packageId, date, addressId);
  }

  @Post('packages')
  @Roles('admin')
  createPackage(@Body() body: any) { return this.groomingService.createPackage(body); }

  @Patch('packages/:id')
  @Roles('admin')
  updatePackage(@Param('id') id: string, @Body() body: any) {
    return this.groomingService.updatePackage(id, body);
  }

  @Post('add-ons')
  @Roles('admin')
  createAddOn(@Body() body: any) { return this.groomingService.createAddOn(body); }

  @Patch('add-ons/:id')
  @Roles('admin')
  updateAddOn(@Param('id') id: string, @Body() body: any) {
    return this.groomingService.updateAddOn(id, body);
  }
}
