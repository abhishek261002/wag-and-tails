import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MapsLocationService } from '../maps-location/maps-location.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { addSeconds } from 'date-fns';

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

@Injectable()
export class WalkingService {
  constructor(
    private prisma: PrismaService,
    private mapsService: MapsLocationService,
    private notificationsService: NotificationsService,
    private realtime: RealtimeGateway
  ) {}

  async getPricing() {
    return this.prisma.walkPricing.findMany({ where: { isActive: true }, orderBy: { durationMinutes: 'asc' } });
  }

  async searchNearbyPartners(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { address: true },
    });

    if (!booking.address) throw new NotFoundException('Booking address not found');

    // Find online partners within radius who walk
    const nearbyPartners = await this.mapsService.findNearbyPartners(
      booking.address.lat,
      booking.address.lng,
      15 // km
    );

    const eligiblePartners = nearbyPartners.filter((p) =>
      p.modes.includes('walking') && p.isOnline
    );

    // Notify each partner of the walk request
    const expiresAt = addSeconds(new Date(), BUSINESS_CONFIG.WALK_REQUEST_EXPIRY_SECONDS);

    for (const partner of eligiblePartners.slice(0, 5)) {
      const payload = {
        bookingId,
        petName: booking.petName,
        petBreed: booking.petBreed,
        durationMinutes: booking.durationMinutes ?? 30,
        customerName: 'Customer',
        customerRating: 4.8,
        pickupAddress: booking.addressLine,
        distanceKm: partner.distanceKm,
        partnerPayout: this.calculatePayout(Number(booking.subtotal)),
        expiresAt: expiresAt.toISOString(),
      };
      await this.notificationsService.sendWalkRequest(partner.id, payload);
      // Push notifications land even when the app is backgrounded; this
      // realtime event is what drives the in-app incoming-job popup while
      // the partner is online and actively looking at the Jobs screen.
      this.realtime.emitToUser(partner.id, 'walk:request_sent', payload);
    }

    return { partnersNotified: eligiblePartners.length, expiresAt };
  }

  async acceptWalkRequest(bookingId: string, partnerId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'searching_partner') {
      throw new BadRequestException('Walk request no longer available');
    }

    const startOtp = generateOtp();
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerId,
        status: 'accepted',
        startOtp,
        statusHistory: {
          create: { status: 'accepted', changedBy: partnerId, note: 'Partner accepted walk request' },
        },
      },
    });

    // Notify customer
    await this.notificationsService.sendPush(booking.customerId, {
      title: 'Walker Found! 🐾',
      body: 'A walker has accepted your walk request and is on the way.',
      data: { bookingId, type: 'walk:accepted' },
    });

    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      include: { user: { include: { profile: true } } },
    });
    this.realtime.emitToBooking(bookingId, 'booking:status_changed', {
      bookingId,
      status: 'accepted',
      partnerId,
      partnerName: partner?.user.profile
        ? `${partner.user.profile.firstName} ${partner.user.profile.lastName}`
        : 'Your walker',
      updatedAt: updated.updatedAt.toISOString(),
    });

    return updated;
  }

  async addLocationPoint(sessionId: string, lat: number, lng: number) {
    return this.prisma.walkLocationPoint.create({
      data: { sessionId, lat, lng, recordedAt: new Date() },
    });
  }

  private calculatePayout(total: number): number {
    return Math.round(Number(total) * (1 - BUSINESS_CONFIG.PLATFORM_COMMISSION_RATE));
  }
}
