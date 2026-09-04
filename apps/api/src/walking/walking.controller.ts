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

  @Post(':bookingId/sessions/start')
  @Roles('partner')
  startSession(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: { sub: string }
  ) {
    return this.walkingService.startWalkSession(bookingId, user.sub);
  }

  @Patch(':bookingId/sessions/end')
  @Roles('partner')
  endSession(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { photos?: string[] }
  ) {
    return this.walkingService.endWalkSession(bookingId, user.sub, body.photos ?? []);
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
