import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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

    return partners
      .filter((p) => p.currentLat != null && p.currentLng != null)
      .map((p) => ({
        id: p.userId,
        modes: p.modes as string[],
        isOnline: p.isOnline,
        serviceRadiusKm: p.serviceRadiusKm,
        distanceKm: this.haversineKm(lat, lng, p.currentLat!, p.currentLng!),
        lat: p.currentLat!,
        lng: p.currentLng!,
      }))
      // A partner can serve the booking location if:
      // (a) the booking is within the requested search radius, AND
      // (b) the booking is within the partner's own service radius
      .filter((p) => p.distanceKm <= radiusKm && p.distanceKm <= p.serviceRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
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
