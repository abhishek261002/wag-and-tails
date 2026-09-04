import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { assertGroomingTransition, assertWalkingTransition } from './booking-state-machine.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { isBefore, addHours } from 'date-fns';
import { BookingType, BookingStatus, BookingChannel, PaymentMethod, Prisma } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService
  ) {}

  async listByCustomer(customerId: string, filters: {
    type?: string; status?: string; page?: number; pageSize?: number;
  } = {}) {
    const { type, status, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BookingWhereInput = {
      customerId,
      ...(type ? { type: type as BookingType } : {}),
      ...(status ? { status: status as BookingStatus } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          pet: true,
          partner: { include: { user: { include: { profile: true } } } },
          addOns: { include: { addOn: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async listAll(filters: {
    type?: string; status?: string; partnerId?: string;
    customerId?: string; from?: string; to?: string;
    page?: number; pageSize?: number;
  } = {}) {
    const { type, status, partnerId, customerId, from, to, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BookingWhereInput = {
      ...(type ? { type: type as BookingType } : {}),
      ...(status ? { status: status as BookingStatus } : {}),
      ...(partnerId ? { partnerId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(from || to ? {
        scheduledAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        }
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { scheduledAt: 'asc' },
        include: {
          customer: { include: { profile: true } },
          pet: true,
          partner: { include: { user: { include: { profile: true } } } },
          addOns: { include: { addOn: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getById(bookingId: string, requesterId: string, requesterRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { include: { profile: true } },
        pet: { include: { careNotes: { orderBy: { createdAt: 'desc' } } } },
        partner: { include: { user: { include: { profile: true } } } },
        addOns: { include: { addOn: true } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        payment: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (requesterRole === 'customer' && booking.customerId !== requesterId) {
      throw new ForbiddenException('Access denied');
    }
    if (requesterRole === 'partner' && booking.partnerId !== requesterId) {
      throw new ForbiddenException('Access denied');
    }

    return booking;
  }

  async createGroomingBooking(customerId: string, data: {
    petId: string; packageId: string; addOnIds?: string[];
    scheduledAt: string; addressId: string; notes?: string;
    couponCode?: string; paymentMethod: string; channel?: string;
  }) {
    // Validate pet ownership
    const pet = await this.prisma.pet.findFirst({ where: { id: data.petId, customerId } });
    if (!pet) throw new NotFoundException('Pet not found or not owned by customer');

    // Validate address ownership
    const address = await this.prisma.address.findFirst({ where: { id: data.addressId, userId: customerId } });
    if (!address) throw new NotFoundException('Address not found');

    // Load package
    const pkg = await this.prisma.groomingPackage.findUnique({ where: { id: data.packageId } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('Grooming package not found');

    // Load add-ons
    const addOnIds = data.addOnIds ?? [];
    const addOns = addOnIds.length > 0
      ? await this.prisma.addOn.findMany({ where: { id: { in: addOnIds }, isActive: true } })
      : [];

    // Calculate pricing
    let subtotal = Number(pkg.price) + addOns.reduce((s, a) => s + Number(a.price), 0);
    let discount = 0;

    if (data.couponCode) {
      const couponResult = await this.couponsService.apply(data.couponCode, 'grooming', subtotal, customerId);
      discount = couponResult.discount;
    }

    const total = subtotal - discount;

    // Get care notes for this pet (latest)
    const careNote = await this.prisma.petCareNote.findFirst({
      where: { petId: data.petId },
      orderBy: { createdAt: 'desc' },
    });

    const booking = await this.prisma.booking.create({
      data: {
        type: 'grooming' as BookingType,
        status: 'pending_payment' as BookingStatus,
        customerId,
        petId: data.petId,
        petName: pet.name,
        petBreed: pet.breed,
        petSize: pet.size,
        petCareNotes: careNote?.note ?? null,
        packageId: data.packageId,
        packageName: pkg.name,
        packagePrice: pkg.price,
        scheduledAt: new Date(data.scheduledAt),
        addressId: data.addressId,
        addressLine: `${address.line1}, ${address.city}`,
        channel: (data.channel ?? 'app') as BookingChannel,
        notes: data.notes ?? null,
        subtotal,
        discount,
        total,
        couponCode: data.couponCode ?? null,
        paymentMethod: data.paymentMethod as PaymentMethod,
        paymentStatus: 'pending' as const,
        addOns: {
          create: addOns.map((a) => ({ addOnId: a.id, name: a.name, price: a.price })),
        },
        statusHistory: {
          create: { status: 'pending_payment', changedBy: customerId },
        },
      },
      include: { addOns: { include: { addOn: true } }, pet: true },
    });

    return booking;
  }

  async createWalkingBooking(customerId: string, data: {
    petId: string; durationMinutes: number; scheduleNow: boolean;
    scheduledAt?: string; addressId: string; couponCode?: string; paymentMethod: string;
  }) {
    const pet = await this.prisma.pet.findFirst({ where: { id: data.petId, customerId } });
    if (!pet) throw new NotFoundException('Pet not found');

    const pricing = await this.prisma.walkPricing.findFirst({
      where: { durationMinutes: data.durationMinutes, isActive: true },
    });
    if (!pricing) throw new BadRequestException('Walk pricing not found for this duration');

    const address = await this.prisma.address.findFirst({ where: { id: data.addressId, userId: customerId } });
    if (!address) throw new NotFoundException('Address not found');

    let subtotal = Number(pricing.price);
    let discount = 0;
    if (data.couponCode) {
      const couponResult = await this.couponsService.apply(data.couponCode, 'walking', subtotal, customerId);
      discount = couponResult.discount;
    }

    const careNote = await this.prisma.petCareNote.findFirst({
      where: { petId: data.petId },
      orderBy: { createdAt: 'desc' },
    });

    const booking = await this.prisma.booking.create({
      data: {
        type: 'walking' as BookingType,
        status: (data.scheduleNow ? 'searching_partner' : 'confirmed') as BookingStatus,
        customerId,
        petId: data.petId,
        petName: pet.name,
        petBreed: pet.breed,
        petSize: pet.size,
        petCareNotes: careNote?.note ?? null,
        durationMinutes: data.durationMinutes,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
        addressId: data.addressId,
        addressLine: `${address.line1}, ${address.city}`,
        channel: 'app' as BookingChannel,
        subtotal,
        discount,
        total: subtotal - discount,
        couponCode: data.couponCode ?? null,
        paymentMethod: data.paymentMethod as PaymentMethod,
        paymentStatus: 'pending' as const,
        statusHistory: {
          create: {
            status: data.scheduleNow ? 'searching_partner' : 'confirmed',
            changedBy: customerId,
          },
        },
      },
      include: { pet: true },
    });

    return booking;
  }

  async transition(
    bookingId: string, newStatus: string,
    changedBy: string, changedByRole: string, note?: string
  ) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    if (booking.type === 'grooming') {
      assertGroomingTransition(booking.status, newStatus);
    } else {
      assertWalkingTransition(booking.status, newStatus);
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus as BookingStatus,
        ...(newStatus === 'completed' ? { completedAt: new Date() } : {}),
        ...(newStatus === 'cancelled' ? { cancelledAt: new Date(), cancelReason: note ?? null } : {}),
        statusHistory: {
          create: { status: newStatus, changedBy, note: note ?? null },
        },
      },
    });

    return updated;
  }

  async reschedule(bookingId: string, customerId: string, scheduledAt: string, reason?: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['confirmed', 'needs_partner', 'assigned'].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be rescheduled in current status');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        scheduledAt: new Date(scheduledAt),
        statusHistory: {
          create: { status: booking.status, changedBy: customerId, note: `Rescheduled: ${reason ?? 'no reason'}` },
        },
      },
    });
  }

  async cancel(bookingId: string, requesterId: string, requesterRole: string, reason?: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    // Authorization
    if (requesterRole === 'customer' && booking.customerId !== requesterId) {
      throw new ForbiddenException('Access denied');
    }

    // Free cancellation window check (customers only)
    if (requesterRole === 'customer' && booking.scheduledAt) {
      const cutoff = addHours(booking.scheduledAt, -BUSINESS_CONFIG.FREE_CANCELLATION_HOURS);
      if (isBefore(cutoff, new Date())) {
        // Late cancellation — allow but flag (fee logic handled by payment service)
      }
    }

    return this.transition(bookingId, 'cancelled', requesterId, requesterRole, reason);
  }

  async getHistory(bookingId: string) {
    return this.prisma.bookingStatusHistory.findMany({
      where: { bookingId },
      orderBy: { changedAt: 'desc' },
    });
  }

  // Staff-only: assign partner to booking using state machine
  async assignPartner(bookingId: string, partnerId: string, staffId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    // Use state machine — from current status to 'assigned'
    // Valid from: needs_partner, confirmed → assigned
    if (!['needs_partner', 'confirmed'].includes(booking.status)) {
      throw new BadRequestException(`Cannot assign partner to booking with status: ${booking.status}`);
    }
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerId,
        status: 'assigned' as BookingStatus,
        statusHistory: {
          create: { status: 'assigned', changedBy: staffId, note: `Partner assigned by staff` },
        },
      },
    });
  }
}
