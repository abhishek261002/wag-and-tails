import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isLocationFilteringEnabled } from '../common/feature-flags.js';
import { normalizeCity } from '../common/city.js';

export interface NearbyPartner {
  id: string;
  modes: string[];
  isOnline: boolean;
  serviceRadiusKm: number;
  distanceKm: number;
  lat: number;
  lng: number;
}

@Injectable()
export class MapsLocationService {
  private readonly logger = new Logger(MapsLocationService.name);

  constructor(private prisma: PrismaService) {}

  async findNearbyPartners(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<NearbyPartner[]> {
    // In production: use PostGIS ST_DWithin with raw query
    // For local dev: load all online partners and filter by haversine
    const partners = await this.prisma.partnerProfile.findMany({
      where: { isOnline: true, status: 'approved' },
      select: {
        userId: true,
        modes: true,
        isOnline: true,
        currentLat: true,
        currentLng: true,
        serviceRadiusKm: true,
      },
    });

    const locationFilteringEnabled = isLocationFilteringEnabled();

    const withDistance = partners
      // In production a partner with no location fixed yet can't be
      // matched at all. In the v1/dev bypass that's exactly the kind of
      // friction this flag exists to remove — a test account that never
      // granted location permission should still be dispatchable.
      .filter((p) => locationFilteringEnabled ? (p.currentLat != null && p.currentLng != null) : true)
      .map((p) => ({
        id: p.userId,
        modes: p.modes as string[],
        isOnline: p.isOnline,
        serviceRadiusKm: p.serviceRadiusKm,
        distanceKm: (p.currentLat != null && p.currentLng != null)
          ? this.haversineKm(lat, lng, p.currentLat, p.currentLng)
          : 0,
        lat: p.currentLat ?? lat,
        lng: p.currentLng ?? lng,
      }));

    if (!locationFilteringEnabled) {
      // v1/dev bypass: every online, approved partner is "nearby" —
      // geofencing, distance checks and service-radius matching are all
      // skipped. Set ENABLE_LOCATION_FILTERING=true (or leave it unset)
      // to restore the real geofenced matching below.
      return withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    // A partner can serve the booking location if:
    // (a) the booking is within the requested search radius, AND
    // (b) the booking is within the partner's own service radius
    return withDistance
      .filter((p) => p.distanceKm <= radiusKm && p.distanceKm <= p.serviceRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // City-based dispatch: operations run per-city (Kanpur, Lucknow, Delhi),
  // not by radius. Every online, approved partner assigned to the given
  // city is a match, full stop — distanceKm is left at 0 since there's no
  // meaningful "distance" concept once matching isn't radius-based.
  async findPartnersInCity(city: string): Promise<NearbyPartner[]> {
    const partners = await this.prisma.partnerProfile.findMany({
      where: { isOnline: true, status: 'approved', city: { not: null } },
      select: {
        userId: true,
        modes: true,
        isOnline: true,
        currentLat: true,
        currentLng: true,
        serviceRadiusKm: true,
        city: true,
      },
    });

    const normalizedCity = normalizeCity(city);
    return partners
      .filter((p) => normalizeCity(p.city ?? '') === normalizedCity)
      .map((p) => ({
        id: p.userId,
        modes: p.modes as string[],
        isOnline: p.isOnline,
        serviceRadiusKm: p.serviceRadiusKm,
        distanceKm: 0,
        lat: p.currentLat ?? 0,
        lng: p.currentLng ?? 0,
      }));
  }

  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const provider = process.env['MAPS_PROVIDER'] ?? 'mock';
    if (provider === 'mock') {
      // Return a deterministic mock location in Bengaluru based on address hash
      // This makes tests reproducible
      let hash = 0;
      for (let i = 0; i < address.length; i++) {
        hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
      }
      const latOffset = ((hash % 100) / 1000); // 0.000–0.099
      const lngOffset = (((hash >> 7) % 100) / 1000);
      return { lat: 12.9716 + latOffset, lng: 77.5946 + lngOffset };
    }
    // TODO: Google Maps / Mapbox geocoding
    return null;
  }

  async getEta(originLat: number, originLng: number, destLat: number, destLng: number) {
    const distanceKm = this.haversineKm(originLat, originLng, destLat, destLng);
    // Mock: assume 20 km/h average in city
    const etaMinutes = Math.ceil((distanceKm / 20) * 60);
    return { distanceKm, etaMinutes };
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
