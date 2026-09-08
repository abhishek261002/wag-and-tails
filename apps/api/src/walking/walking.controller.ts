import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WalkingService } from './walking.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('walking')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('walking')
export class WalkingController {
  constructor(private walkingService: WalkingService) {}

  @Get('pricing')
  @Roles('customer', 'partner', 'staff', 'admin')
  getPricing() { return this.walkingService.getPricing(); }

  @Post(':bookingId/search-partners')
  @Roles('customer')
  searchPartners(@Param('bookingId') bookingId: string) {
    return this.walkingService.searchNearbyPartners(bookingId);
  }

  // A walk request sits at `searching_partner`, not `needs_partner`, so it
  // can't go through PartnersController's generic /jobs/:id/claim (that
  // only matches needs_partner, i.e. grooming). This is the walking-specific
  // equivalent — accepting is what generates its start OTP and moves it to
  // `accepted`, from which the shared on-the-way/arrived/verify-start/
  // complete endpoints on PartnersController take over for both job types.
  @Post(':bookingId/accept')
  @Roles('partner')
  acceptWalkRequest(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: { sub: string }
  ) {
    return this.walkingService.acceptWalkRequest(bookingId, user.sub);
  }

  @Post('sessions/:sessionId/location')
  @Roles('partner')
  addLocationPoint(
    @Param('sessionId') sessionId: string,
    @Body() body: { lat: number; lng: number }
  ) {
    return this.walkingService.addLocationPoint(sessionId, body.lat, body.lng);
  }
}
