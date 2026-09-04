import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MapsLocationService } from '../maps-location/maps-location.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { addSeconds } from 'date-fns';

@Injectable()
export class WalkingService {
  constructor(
    private prisma: PrismaService,
    private mapsService: MapsLocationService,
    private notificationsService: NotificationsService
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
      await this.notificationsService.sendWalkRequest(partner.id, {
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
      });
    }

    return { partnersNotified: eligiblePartners.length, expiresAt };
  }

  async acceptWalkRequest(bookingId: string, partnerId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'searching_partner') {
      throw new BadRequestException('Walk request no longer available');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerId,
        status: 'accepted',
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

    return updated;
  }

  async startWalkSession(bookingId: string, partnerId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, partnerId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const session = await this.prisma.walkSession.create({
      data: { bookingId, partnerId, startedAt: new Date() },
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'in_progress',
        statusHistory: {
          create: { status: 'in_progress', changedBy: partnerId, note: 'Walk started' },
        },
      },
    });

    return session;
  }

  async endWalkSession(bookingId: string, partnerId: string, photos: string[]) {
    const session = await this.prisma.walkSession.findFirst({
      where: { bookingId, partnerId, endedAt: null },
    });
    if (!session) throw new NotFoundException('Active walk session not found');

    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - session.startedAt!.getTime()) / 1000);

    const updated = await this.prisma.walkSession.update({
      where: { id: session.id },
      data: { endedAt, durationSeconds, photos },
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'completed',
        completedAt: endedAt,
        statusHistory: {
          create: { status: 'completed', changedBy: partnerId, note: 'Walk completed' },
        },
      },
    });

    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await this.notificationsService.sendPush(booking.customerId, {
      title: 'Walk Complete! 🏁',
      body: `${booking.petName}'s walk is done. Great job today!`,
      data: { bookingId, type: 'walk:completed' },
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
