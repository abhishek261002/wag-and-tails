import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MapsLocationService } from './maps-location.service.js';
import { isValidCoordinate, serviceCities, suggestedAreaLine } from './places.js';

const num = (v: string | undefined) => (v === undefined || v === '' ? NaN : Number(v));

// Address search for the customer app. Every call spends the provider's quota, so it is signed-in only and
// rate limited per client on top of the provider-side caching.
@ApiTags('maps')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Throttle({ default: { limit: 40, ttl: 60_000 } })
@Controller('maps')
export class MapsController {
  constructor(private maps: MapsLocationService) {}

  @Get('service-cities')
  cities() {
    return { cities: serviceCities() };
  }

  @Get('autocomplete')
  async autocomplete(@Query('q') q?: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    const query = (q ?? '').trim();
    if (query.length < 3) return { suggestions: [] };
    if (query.length > 120) throw new BadRequestException('Search text is too long');
    const bias = isValidCoordinate(num(lat), num(lng)) ? { lat: num(lat), lng: num(lng) } : undefined;
    return { suggestions: await this.maps.autocomplete(query, bias) };
  }

  @Get('reverse')
  async reverse(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    const la = num(lat), ln = num(lng);
    if (!isValidCoordinate(la, ln)) throw new BadRequestException('A valid latitude and longitude in India are required');
    const place = await this.maps.reverseGeocode(la, ln);
    if (!place) return { place: null };
    return { place: { ...place, areaLine: suggestedAreaLine(place) } };
  }
}
