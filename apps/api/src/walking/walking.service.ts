import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MapsLocationService } from '../maps-location/maps-location.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { isLocationFilteringEnabled } from '../common/feature-flags.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { DispatchService, claimableBy } from '../bookings/dispatch.service.js';
import { CommissionService } from '../commission/commission.service.js';
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
    private realtime: RealtimeGateway,
    private messagingService: MessagingService,
    private dispatch: DispatchService,
    private commission: CommissionService
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

    // A walk reserved for one chosen walker goes to that walker only.
    if (booking.assignmentMode === 'specific') {
      const expiresAt = await this.dispatch.openRequestWindow(bookingId);
      await this.dispatch.notifyRequestedPartner(bookingId);
      return { partnersNotified: 1, expiresAt };
    }

    const locationFilteringEnabled = isLocationFilteringEnabled();

    // City-based dispatch in production: every online, walking-mode partner
    // assigned to the booking's city gets notified — no radius involved.
    // The dev bypass keeps using findNearbyPartners (which itself already
    // ignores distance when the flag is off) purely so local test accounts
    // don't need matching city AND lat/lng data.
    const nearbyPartners = locationFilteringEnabled
      ? await this.mapsService.findPartnersInCity(booking.address.city)
      : await this.mapsService.findNearbyPartners(booking.address.lat, booking.address.lng, 15);

    const eligiblePartners = nearbyPartners.filter((p) =>
      p.modes.includes('walking') && p.isOnline
    );

    // Notify each partner of the walk request
    const expiresAt = addSeconds(new Date(), BUSINESS_CONFIG.WALK_REQUEST_EXPIRY_SECONDS);
    const commonPayload = {
      bookingId,
      petName: booking.petName,
      petBreed: booking.petBreed,
      durationMinutes: booking.durationMinutes ?? 30,
      customerName: 'Customer',
      customerRating: 4.8,
      pickupAddress: booking.addressLine,
      partnerPayout: this.calculatePayout(Number(booking.subtotal)),
      expiresAt: expiresAt.toISOString(),
    };

    if (!locationFilteringEnabled) {
      // v1/dev bypass: push notifications still go to the (now
      // distance-unfiltered, via findNearbyPartners) eligible list, but the
      // realtime event broadcasts to every connected partner via the
      // `role:partner` room instead of per-user targeting — see
      // PaymentsService.dispatchGroomingBooking for the grooming equivalent
      // and how to restore production targeting.
      for (const partner of eligiblePartners) {
        await this.notificationsService.sendWalkRequest(partner.id, { ...commonPayload, distanceKm: partner.distanceKm });
      }
      this.realtime.emitToRole('partner', 'walk:request_sent', { ...commonPayload, distanceKm: 0 });
      return { partnersNotified: eligiblePartners.length, expiresAt };
    }

    // Every walking-mode partner in the booking's city gets notified — no
    // cap, since dispatch is city-wide rather than nearest-N by distance.
    for (const partner of eligiblePartners) {
      const payload = { ...commonPayload, distanceKm: partner.distanceKm };
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
      throw new ConflictException({ code: 'JOB_TAKEN', message: 'Walk request no longer available' });
    }
    const me = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId } });
    if (!me || me.status !== 'approved') throw new ForbiddenException('Your account must be approved before you can accept walks');
    if (!me.modes.includes('walking')) throw new ForbiddenException('Your profile is not set up for walking jobs');
    await this.commission.assertCanTakeJobs(partnerId);

    // Conditional update: of several walkers accepting at once, exactly one row matches. A walk
    // reserved for someone else never matches.
    const startOtp = generateOtp();
    const claimed = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'searching_partner', partnerId: null, ...claimableBy(partnerId) },
      data: { partnerId, status: 'accepted', startOtp },
    });
    if (claimed.count === 0) {
      throw new ConflictException({ code: 'JOB_TAKEN', message: 'This walk was just taken or is reserved for another walker' });
    }
    await this.prisma.bookingStatusHistory.create({
      data: { bookingId, status: 'accepted', changedBy: partnerId, note: 'Partner accepted walk request' },
    });
    await this.commission.applyClaimPricing(bookingId, partnerId);
    const updated = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    // Notify customer
    await this.notificationsService.sendPush(booking.customerId, {
      title: 'Walker Found! 🐾',
      body: 'A walker has accepted your walk request and is on the way.',
      data: { bookingId, type: 'walk:accepted' },
    });

    // Chat opens the moment the walk is accepted, mirroring
    // PartnersService.claimJob for grooming bookings.
    await this.messagingService.getOrCreateConversation(bookingId, partnerId);

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
