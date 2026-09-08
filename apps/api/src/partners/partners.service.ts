import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { BookingType, PartnerStatus, Prisma } from '@prisma/client';

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private notificationsService: NotificationsService
  ) {}

  async getProfile(partnerId: string) {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      include: {
        user: { include: { profile: true } },
        availability: true,
        neighborhoods: { include: { neighborhood: true } },
      },
    });
    if (!partner) throw new NotFoundException('Partner profile not found');
    return partner;
  }

  async updateProfile(partnerId: string, data: Partial<{
    serviceRadiusKm: number; modes: string[];
    bio: string; bankAccountNumber: string; ifscCode: string;
  }>) {
    return this.prisma.partnerProfile.update({ where: { userId: partnerId }, data });
  }

  async setOnlineStatus(partnerId: string, online: boolean) {
    return this.prisma.partnerProfile.update({
      where: { userId: partnerId },
      data: { isOnline: online, lastSeenAt: new Date() },
    });
  }

  async updateLocation(partnerId: string, lat: number, lng: number, heading?: number) {
    await this.prisma.partnerProfile.update({
      where: { userId: partnerId },
      data: { currentLat: lat, currentLng: lng },
    });

    // Upsert real-time location record
    await this.prisma.partnerLocation.upsert({
      where: { partnerId },
      update: { lat, lng, heading: heading ?? null, updatedAt: new Date() },
      create: { partnerId, lat, lng, heading: heading ?? null },
    });

    // Broadcast to whichever booking this partner is actively on, so the
    // customer's tracking screen (and the partner's own, for the mirrored
    // view) updates live instead of polling.
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        partnerId,
        status: { in: ['assigned', 'accepted', 'partner_on_the_way', 'arrived', 'in_progress'] },
      },
      select: { id: true },
    });
    if (activeBooking) {
      this.realtime.emitToBooking(activeBooking.id, 'partner:location_updated', {
        partnerId,
        bookingId: activeBooking.id,
        lat,
        lng,
        heading: heading ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getOpenJobs(partnerId: string) {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      include: { neighborhoods: true },
    });
    if (!partner || !partner.isOnline) return [];

    // Jobs that need a partner and match this partner's mode and radius
    const validModes = partner.modes.filter((m): m is BookingType =>
      Object.values(BookingType).includes(m as BookingType)
    );

    const openBookings = await this.prisma.booking.findMany({
      where: {
        type: { in: validModes },
        status: 'needs_partner',
        partnerId: null,
        scheduledAt: { gte: new Date() },
      },
      include: {
        pet: true,
        customer: { include: { profile: true } },
        address: true,
        addOns: { include: { addOn: true } },
        package: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });

    // Filter by radius (simple Euclidean — PostGIS used in prod via raw query)
    const lat = partner.currentLat ?? null;
    const lng = partner.currentLng ?? null;
    const radiusKm = Math.min(partner.serviceRadiusKm, BUSINESS_CONFIG.MAX_WALK_RADIUS_KM);

    return openBookings
      .filter((b) => {
        if (!b.address || lat == null || lng == null) return true;
        const dist = this.haversineKm(lat, lng, b.address.lat, b.address.lng);
        return dist <= radiusKm;
      })
      .map((b) => ({
        bookingId: b.id,
        type: b.type,
        petName: b.petName,
        petBreed: b.petBreed,
        petSize: b.petSize,
        petWeightKg: b.pet?.weightKg ?? null,
        petCareNotes: b.petCareNotes,
        customerName: b.customer?.profile
          ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}`
          : 'Customer',
        customerRating: 4.8,
        addressLine: b.addressLine,
        distanceKm: (lat != null && b.address) ? this.haversineKm(lat, lng!, b.address.lat, b.address.lng) : 0,
        scheduledAt: b.scheduledAt,
        packageName: b.package?.name,
        addOns: b.addOns.map((a) => a.addOn.name),
        durationMinutes: b.durationMinutes,
        partnerPayout: Math.round(Number(b.total) * (1 - BUSINESS_CONFIG.PLATFORM_COMMISSION_RATE)),
        status: b.status,
      }));
  }

  async claimJob(bookingId: string, partnerId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, status: 'needs_partner' },
    });
    if (!booking) throw new NotFoundException('Job not available');

    const startOtp = generateOtp();
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerId,
        status: 'assigned',
        startOtp,
        statusHistory: {
          create: { status: 'assigned', changedBy: partnerId, note: 'Partner claimed job' },
        },
      },
    });

    await this.notifyAssigned(bookingId, partnerId);
    return updated;
  }

  private async notifyAssigned(bookingId: string, partnerId: string) {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      include: { user: { include: { profile: true } } },
    });
    const partnerName = partner?.user.profile
      ? `${partner.user.profile.firstName} ${partner.user.profile.lastName}`
      : 'Your partner';

    this.realtime.emitToBooking(bookingId, 'booking:status_changed', {
      bookingId,
      status: 'assigned',
      partnerId,
      partnerName,
      updatedAt: new Date().toISOString(),
    });
  }

  async getMyJobs(partnerId: string, status?: string) {
    const where: Record<string, unknown> = { partnerId };
    if (status) where['status'] = status;

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        pet: { include: { careNotes: { orderBy: { createdAt: 'desc' }, take: 3 } } },
        customer: { include: { profile: true } },
        address: true,
        addOns: { include: { addOn: true } },
        package: { include: { items: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Flattened to the same card shape getOpenJobs() returns, since both
    // feed the same list-card components on the partner app (which key
    // navigation off `bookingId`, not Prisma's raw `id`).
    return bookings.map((b) => ({
      bookingId: b.id,
      type: b.type,
      petName: b.petName,
      petBreed: b.petBreed,
      petSize: b.petSize,
      petWeightKg: b.pet?.weightKg ?? null,
      petCareNotes: b.petCareNotes,
      customerName: b.customer?.profile
        ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}`
        : 'Customer',
      customerRating: 4.8,
      addressLine: b.addressLine,
      distanceKm: 0,
      scheduledAt: b.scheduledAt,
      packageName: b.package?.name,
      addOns: b.addOns.map((a) => a.addOn.name),
      durationMinutes: b.durationMinutes,
      partnerPayout: Math.round(Number(b.total) * (1 - BUSINESS_CONFIG.PLATFORM_COMMISSION_RATE)),
      status: b.status,
    }));
  }

  // Mirrors Uber's flow: assigned/accepted -> on the way -> arrived (OTP
  // shown to customer, entered by partner) -> in progress -> completed.
  // Each step broadcasts to the booking room so both apps' live-tracking
  // screens update without polling.

  async markOnTheWay(bookingId: string, partnerId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, partnerId, status: { in: ['assigned', 'accepted'] } },
    });
    if (!booking) throw new NotFoundException('Assigned job not found');

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'partner_on_the_way',
        statusHistory: {
          create: { status: 'partner_on_the_way', changedBy: partnerId, note: 'Partner is on the way' },
        },
      },
    });

    this.realtime.emitToBooking(bookingId, 'booking:status_changed', {
      bookingId, status: 'partner_on_the_way', partnerId, updatedAt: updated.updatedAt.toISOString(),
    });
    return updated;
  }

  async markArrived(bookingId: string, partnerId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, partnerId, status: 'partner_on_the_way' },
    });
    if (!booking) throw new NotFoundException('Job not on the way');

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'arrived',
        statusHistory: {
          create: { status: 'arrived', changedBy: partnerId, note: 'Partner has arrived' },
        },
      },
    });

    this.realtime.emitToBooking(bookingId, 'booking:status_changed', {
      bookingId, status: 'arrived', partnerId, updatedAt: updated.updatedAt.toISOString(),
    });
    return updated;
  }

  async verifyStartOtp(bookingId: string, partnerId: string, otp: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, partnerId, status: 'arrived' },
    });
    if (!booking) throw new NotFoundException('Job not awaiting start');
    if (!booking.startOtp || booking.startOtp !== otp) {
      throw new BadRequestException('Incorrect code');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'in_progress',
        startOtp: null,
        statusHistory: {
          create: { status: 'in_progress', changedBy: partnerId, note: 'Session started (OTP verified)' },
        },
      },
    });

    // Walking sessions track a live GPS trail via WalkSession/WalkLocationPoint;
    // start one here so `partner:location_updated` events have somewhere to
    // land without coupling PartnersModule to WalkingModule.
    if (booking.type === 'walking') {
      await this.prisma.walkSession.create({
        data: { bookingId, partnerId, startedAt: new Date() },
      });
    }

    this.realtime.emitToBooking(bookingId, 'booking:status_changed', {
      bookingId, status: 'in_progress', partnerId, updatedAt: updated.updatedAt.toISOString(),
    });
    return updated;
  }

  async completeJob(bookingId: string, partnerId: string, data: {
    checklistItems: string[]; beforePhotos: string[]; afterPhotos: string[];
  }) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, partnerId, status: 'in_progress' },
    });
    if (!booking) throw new NotFoundException('Active job not found');

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        beforePhotos: data.beforePhotos,
        afterPhotos: data.afterPhotos,
        checklistCompleted: data.checklistItems,
        statusHistory: {
          create: { status: 'completed', changedBy: partnerId, note: 'Job completed' },
        },
      },
    });

    if (booking.type === 'walking') {
      const session = await this.prisma.walkSession.findFirst({
        where: { bookingId, partnerId, endedAt: null },
      });
      if (session) {
        const endedAt = new Date();
        const durationSeconds = Math.floor((endedAt.getTime() - session.startedAt!.getTime()) / 1000);
        await this.prisma.walkSession.update({
          where: { id: session.id },
          data: { endedAt, durationSeconds, photos: data.afterPhotos },
        });
      }
      await this.notificationsService.sendPush(booking.customerId, {
        title: 'Walk Complete! 🏁',
        body: `${booking.petName}'s walk is done. Great job today!`,
        data: { bookingId, type: 'walk:completed' },
      });
    }

    this.realtime.emitToBooking(bookingId, 'booking:status_changed', {
      bookingId, status: 'completed', partnerId, updatedAt: updated.updatedAt.toISOString(),
    });
    return updated;
  }

  async getEarnings(partnerId: string) {
    const payouts = await this.prisma.payout.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });

    const total = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.netAmount), 0);
    const pending = payouts.filter((p) => ['pending', 'requested'].includes(p.status))
      .reduce((s, p) => s + Number(p.netAmount), 0);

    return { total, pending, payouts: payouts.slice(0, 20) };
  }

  async getAvailability(partnerId: string) {
    return this.prisma.partnerAvailability.findMany({
      where: { partnerId },
      orderBy: { day: 'asc' },
    });
  }

  async upsertAvailability(partnerId: string, availability: Array<{
    day: string; startTime: string; endTime: string;
  }>) {
    // Delete existing and recreate
    await this.prisma.partnerAvailability.deleteMany({ where: { partnerId } });
    if (availability.length === 0) return [];
    return this.prisma.partnerAvailability.createMany({
      data: availability.map((a) => ({ partnerId, day: a.day, startTime: a.startTime, endTime: a.endTime })),
    });
  }

  async getDocuments(partnerId: string) {
    return this.prisma.partnerDocument.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocument(partnerId: string, docType: string, fileUrl: string) {
    return this.prisma.partnerDocument.create({
      data: { partnerId, docType, fileUrl },
    });
  }

  async getReviews(partnerId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { revieweeId: partnerId, revieweeType: 'partner' },
      include: { reviewer: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const avg = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        reviewerName: r.reviewerName,
        rating: r.rating,
        comment: r.comment,
        tip: r.tip ? Number(r.tip) : null,
        createdAt: r.createdAt,
      })),
      avg: Math.round(avg * 10) / 10,
      count: reviews.length,
    };
  }

  async listAll(filters: { status?: string; page?: number; pageSize?: number } = {}) {
    const { status, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;
    const where: Prisma.PartnerProfileWhereInput = status ? { status: status as PartnerStatus } : {};

    const [data, total] = await Promise.all([
      this.prisma.partnerProfile.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: { include: { profile: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.partnerProfile.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async approve(partnerId: string, adminId: string) {
    return this.prisma.partnerProfile.update({
      where: { userId: partnerId },
      data: { status: 'approved', approvedBy: adminId, approvedAt: new Date() },
    });
  }

  async suspend(partnerId: string, reason: string) {
    return this.prisma.partnerProfile.update({
      where: { userId: partnerId },
      data: { status: 'suspended', suspendReason: reason },
    });
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
