import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BUSINESS_CONFIG } from '@wag/config';

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

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
  }

  async getOpenJobs(partnerId: string) {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      include: { neighborhoods: true },
    });
    if (!partner || !partner.isOnline) return [];

    // Jobs that need a partner and match this partner's mode and radius
    const radiusKm = Math.min(
      partner.serviceRadiusKm,
      BUSINESS_CONFIG.MAX_WALK_RADIUS_KM
    );

    const openBookings = await this.prisma.booking.findMany({
      where: {
        type: { in: partner.modes as string[] },
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
    const lat = partner.currentLat;
    const lng = partner.currentLng;

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
        distanceKm: lat && b.address ? this.haversineKm(lat, lng, b.address.lat, b.address.lng) : 0,
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

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerId,
        status: 'assigned',
        statusHistory: {
          create: { status: 'assigned', changedBy: partnerId, note: 'Partner claimed job' },
        },
      },
    });
  }

  async getMyJobs(partnerId: string, status?: string) {
    const where: Record<string, unknown> = { partnerId };
    if (status) where['status'] = status;

    return this.prisma.booking.findMany({
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
  }

  async completeJob(bookingId: string, partnerId: string, data: {
    checklistItems: string[]; beforePhotos: string[]; afterPhotos: string[];
  }) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, partnerId, status: 'in_progress' },
    });
    if (!booking) throw new NotFoundException('Active job not found');

    return this.prisma.booking.update({
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

  async listAll(filters: { status?: string; page?: number; pageSize?: number } = {}) {
    const { status, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};

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
