import {
  Controller, Get, Post, Patch, Put, Param, Body, Query, UseGuards
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

  @Patch('jobs/:bookingId/on-the-way')
  @Roles('partner')
  markOnTheWay(@Param('bookingId') bookingId: string, @CurrentUser() user: { sub: string }) {
    return this.partnersService.markOnTheWay(bookingId, user.sub);
  }

  @Patch('jobs/:bookingId/arrived')
  @Roles('partner')
  markArrived(@Param('bookingId') bookingId: string, @CurrentUser() user: { sub: string }) {
    return this.partnersService.markArrived(bookingId, user.sub);
  }

  @Patch('jobs/:bookingId/verify-start')
  @Roles('partner')
  verifyStartOtp(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { otp: string }
  ) {
    return this.partnersService.verifyStartOtp(bookingId, user.sub, body.otp);
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

  @Get('availability')
  @Roles('partner')
  getAvailability(@CurrentUser() user: { sub: string }) {
    return this.partnersService.getAvailability(user.sub);
  }

  @Put('availability')
  @Roles('partner')
  upsertAvailability(
    @CurrentUser() user: { sub: string },
    @Body() body: { availability: Array<{ day: string; startTime: string; endTime: string }> }
  ) {
    return this.partnersService.upsertAvailability(user.sub, body.availability);
  }

  @Get('documents')
  @Roles('partner')
  getDocuments(@CurrentUser() user: { sub: string }) {
    return this.partnersService.getDocuments(user.sub);
  }

  @Post('documents')
  @Roles('partner')
  uploadDocument(
    @CurrentUser() user: { sub: string },
    @Body() body: { docType: string; fileUrl: string }
  ) {
    return this.partnersService.uploadDocument(user.sub, body.docType, body.fileUrl);
  }

  @Get('reviews')
  @Roles('partner')
  getReviews(@CurrentUser() user: { sub: string }) {
    return this.partnersService.getReviews(user.sub);
  }
}
