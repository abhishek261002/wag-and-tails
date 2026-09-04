import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PartnersService } from './partners.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('partner')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('partner')
export class PartnersController {
  constructor(private partnersService: PartnersService) {}

  @Get('profile')
  @Roles('partner')
  getProfile(@CurrentUser() user: { sub: string }) {
    return this.partnersService.getProfile(user.sub);
  }

  @Patch('profile')
  @Roles('partner')
  updateProfile(@CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.partnersService.updateProfile(user.sub, body);
  }

  @Patch('online')
  @Roles('partner')
  setOnline(@CurrentUser() user: { sub: string }, @Body() body: { online: boolean }) {
    return this.partnersService.setOnlineStatus(user.sub, body.online);
  }

  @Post('location')
  @Roles('partner')
  updateLocation(
    @CurrentUser() user: { sub: string },
    @Body() body: { lat: number; lng: number; heading?: number }
  ) {
    return this.partnersService.updateLocation(user.sub, body.lat, body.lng, body.heading);
  }

  @Get('jobs/open')
  @Roles('partner')
  getOpenJobs(@CurrentUser() user: { sub: string }) {
    return this.partnersService.getOpenJobs(user.sub);
  }

  @Post('jobs/:bookingId/claim')
  @Roles('partner')
  claimJob(@Param('bookingId') bookingId: string, @CurrentUser() user: { sub: string }) {
    return this.partnersService.claimJob(bookingId, user.sub);
  }

  @Get('jobs/mine')
  @Roles('partner')
  getMyJobs(@CurrentUser() user: { sub: string }, @Query('status') status?: string) {
    return this.partnersService.getMyJobs(user.sub, status);
  }

  @Patch('jobs/:bookingId/complete')
  @Roles('partner')
  completeJob(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: { sub: string },
    @Body() body: any
  ) {
    return this.partnersService.completeJob(bookingId, user.sub, body);
  }

  @Get('earnings')
  @Roles('partner')
  getEarnings(@CurrentUser() user: { sub: string }) {
    return this.partnersService.getEarnings(user.sub);
  }
}
