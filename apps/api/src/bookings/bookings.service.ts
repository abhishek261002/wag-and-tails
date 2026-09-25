import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RoutingService } from '../routing/routing.service.js';
import { encodePolyline } from '../common/navigation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DispatchService, dispatchState, directRequestTtlMinutes } from './dispatch.service.js';
import { isLocationFilteringEnabled } from '../common/feature-flags.js';
import { normalizeCity } from '../common/city.js';
import { isOverLimit, limitFor, loadActiveDiscounts, loadDues, loadSettings } from '../commission/queries.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { assertGroomingTransition, assertWalkingTransition } from './booking-state-machine.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { speciesSupportsService } from '../common/species.js';
import { isBefore, addHours } from 'date-fns';
import { BookingType, BookingStatus, BookingChannel, PaymentMethod, Prisma } from '@prisma/client';

// `include: { customer: ..., partner: { include: { user: ... } } }` pulls
// the full User row on both sides — including passwordHash — straight
// into a response every one of these methods sends to a client. Strips it
// from both without needing to switch every query to an explicit `select`.
function stripBookingPasswordHashes<T extends { customer?: any; partner?: { user?: any } | null }>(booking: T): T {
  const result: any = { ...booking };
  if (result.customer?.passwordHash !== undefined) {
    const { passwordHash, ...rest } = result.customer;
    result.customer = rest;
  }
  if (result.partner?.user?.passwordHash !== undefined) {
    const { passwordHash, ...rest } = result.partner.user;
    result.partner = { ...result.partner, user: rest };
  }
  return result;
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
    private dispatch: DispatchService,
    private moduleRef: ModuleRef,
    private routing: RoutingService
  ) {}

  // Turns the customer's dispatch choice into booking fields, after checking the chosen partner can
  // actually take this booking. "Find anyone" is the default.
  private async resolveDispatch(
    input: { assignmentMode?: unknown; requestedPartnerId?: unknown },
    ctx: { type: BookingType; species: string; city: string }
  ): Promise<{ assignmentMode: 'any' | 'specific'; requestedPartnerId: string | null }> {
    const mode = input.assignmentMode ?? 'any';
    if (mode !== 'any' && mode !== 'specific') throw new BadRequestException('assignmentMode must be "any" or "specific"');
    if (mode === 'any') return { assignmentMode: 'any', requestedPartnerId: null };
    if (typeof input.requestedPartnerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.requestedPartnerId)) {
      throw new BadRequestException('Choose a partner');
    }
    await this.assertSelectable(input.requestedPartnerId, ctx);
    return { assignmentMode: 'specific', requestedPartnerId: input.requestedPartnerId };
  }

  private async assertSelectable(partnerId: string, ctx: { type: BookingType; species: string; city: string }) {
    const p = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId } });
    const bad = (m: string): never => {
      throw new UnprocessableEntityException({ code: 'PARTNER_NOT_AVAILABLE', message: m });
    };
    if (!p || p.status !== 'approved') return bad('This partner is not available');
    const [settings, dues] = await Promise.all([loadSettings(this.prisma), loadDues(this.prisma, [partnerId])]);
    if (isOverLimit(dues.get(partnerId) ?? 0, limitFor(p.commissionLimitOverride, settings))) return bad('This partner is not taking new jobs right now');
    if (!p.modes.includes(ctx.type)) return bad(`This partner does not offer ${ctx.type}`);
    if (!(p.petSpecies as string[]).includes(ctx.species)) return bad(`This partner does not take ${ctx.species}s`);
    if (isLocationFilteringEnabled() && normalizeCity(p.city ?? '') !== normalizeCity(ctx.city)) {
      return bad('This partner does not serve your area');
    }
  }

  /**
   * The route the partner is driving to the booking address, for the partner's turn-by-turn screen (with
   * steps) and for the customer's live map (path and ETA only). The origin is the partner's live position.
   */
  async getRoute(bookingId: string, user: { sub: string; role: string }, q: { fromLat?: string; fromLng?: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { address: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    const isPartner = user.role === 'partner' && booking.partnerId === user.sub;
    const isCustomer = user.role === 'customer' && booking.customerId === user.sub;
    if (!isPartner && !isCustomer) throw new ForbiddenException('Access denied');
    if (!booking.partnerId || !['assigned', 'accepted', 'partner_on_the_way', 'arrived'].includes(booking.status)) {
      throw new BadRequestException('There is no route for this booking right now');
    }
    if (!booking.address) throw new BadRequestException('The booking has no address');

    let from: { lat: number; lng: number } | null = null;
    if (isPartner && q.fromLat !== undefined && q.fromLng !== undefined) {
      const la = Number(q.fromLat), ln = Number(q.fromLng);
      if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) throw new BadRequestException('fromLat/fromLng are not a valid position');
      from = { lat: la, lng: ln };
    } else {
      const loc = await this.prisma.partnerLocation.findUnique({ where: { partnerId: booking.partnerId } });
      if (loc) from = { lat: loc.lat, lng: loc.lng };
    }
    const destination = { lat: booking.address.lat, lng: booking.address.lng, label: booking.addressLine };
    // The partner has not shared a position yet (e.g. just accepted): nothing to draw, not an error.
    if (!from) return { available: false as const, destination };

    const route = await this.routing.getRoute(from, destination);
    return {
      available: true as const,
      destination,
      from,
      approximate: route.approximate,
      provider: route.provider,
      distanceMeters: Math.round(route.distanceMeters),
      durationSeconds: Math.round(route.durationSeconds),
      arrivalAt: new Date(Date.now() + route.durationSeconds * 1000).toISOString(),
      polyline: encodePolyline(route.geometry),
      // The customer only needs the line and the ETA; turn instructions are for the person driving.
      steps: isPartner ? route.steps : [],
    };
  }

  // Partner cards for the checkout "choose a partner" and "past partners" lists.
  async getPartnerOptions(customerId: string, q: { type?: string; petId?: string; addressId?: string }) {
    if (q.type !== 'grooming' && q.type !== 'walking') throw new BadRequestException('type must be grooming or walking');
    const [pet, address] = await Promise.all([
      this.prisma.pet.findFirst({ where: { id: String(q.petId ?? ''), customerId } }),
      this.prisma.address.findFirst({ where: { id: String(q.addressId ?? ''), userId: customerId } }),
    ]);
    if (!pet) throw new NotFoundException('Pet not found');
    if (!address) throw new NotFoundException('Address not found');
    if (q.type === 'walking' && !speciesSupportsService(pet.species, 'walking')) {
      throw new UnprocessableEntityException({ code: 'SPECIES_NOT_SUPPORTED', message: 'Walks are only available for dogs' });
    }

    const partners = await this.prisma.partnerProfile.findMany({
      where: {
        status: 'approved',
        modes: { has: q.type },
        petSpecies: { has: pet.species },
        ...(isLocationFilteringEnabled() ? { city: { equals: address.city, mode: 'insensitive' as const } } : {}),
      },
      include: { user: { include: { profile: true } } },
      take: 100,
    });

    // Partners over their commission limit cannot take jobs, so they are not offered either.
    const ids = partners.map((p) => p.userId);
    const [settings, dues, discounts] = await Promise.all([loadSettings(this.prisma), loadDues(this.prisma, ids), loadActiveDiscounts(this.prisma, ids)]);
    const available = partners.filter((p) => !isOverLimit(dues.get(p.userId) ?? 0, limitFor(p.commissionLimitOverride, settings)));

    const history = await this.prisma.booking.groupBy({
      by: ['partnerId'],
      where: { customerId, status: 'completed', partnerId: { in: available.map((p) => p.userId) } },
      _count: { _all: true },
      _max: { completedAt: true },
    });
    const past = new Map(history.map((h) => [h.partnerId, { count: h._count._all, last: h._max.completedAt }]));

    return available
      .map((p) => {
        const h = past.get(p.userId);
        const first = p.user.profile?.firstName ?? '';
        const last = p.user.profile?.lastName ?? '';
        return {
          partnerId: p.userId,
          name: `${first} ${(last[0] ?? '').toUpperCase()}${last ? '.' : ''}`.trim() || 'Partner',
          photoUrl: p.photoUrl,
          rating: Number(p.rating),
          reviewCount: p.reviewCount,
          completedJobs: p.completedJobs,
          bio: p.bio,
          isOnline: p.isOnline,
          // Percent off the service price this partner is offering right now (valid, staff-approved), if any.
          discountPct: discounts.get(p.userId) ?? null,
          isPast: !!h,
          timesBookedByYou: h?.count ?? 0,
          lastBookedAt: h?.last ?? null,
        };
      })
      .sort((a, b) => Number(b.isPast) - Number(a.isPast) || Number(b.isOnline) - Number(a.isOnline) || b.rating - a.rating || b.completedJobs - a.completedJobs);
  }

  // The customer picks again after their chosen partner declined or did not answer (or changes mind
  // before anyone accepted). Re-announces the booking accordingly.
  async redispatch(bookingId: string, customerId: string, input: { assignmentMode?: unknown; requestedPartnerId?: unknown }) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, customerId }, include: { address: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['needs_partner', 'searching_partner'].includes(booking.status) || booking.partnerId) {
      throw new BadRequestException('This booking already has a partner or is no longer looking for one');
    }
    const next = await this.resolveDispatch(input, {
      type: booking.type,
      species: booking.petSpecies,
      city: booking.address?.city ?? '',
    });

    // Conditional on the state we read, so a partner accepting at this exact moment wins cleanly.
    const changed = await this.prisma.booking.updateMany({
      where: { id: bookingId, customerId, partnerId: null, status: booking.status },
      data: { ...next, requestOutcome: null, requestExpiresAt: null },
    });
    if (changed.count === 0) throw new BadRequestException('This booking just got a partner');

    if (next.assignmentMode === 'specific') {
      await this.dispatch.openRequestWindow(bookingId);
      await this.dispatch.notifyRequestedPartner(bookingId);
    } else if (booking.type === 'walking') {
      const { WalkingService } = await import('../walking/walking.service.js');
      await this.moduleRef.get(WalkingService, { strict: false }).searchNearbyPartners(bookingId);
    } else {
      const { PaymentsService } = await import('../payments/payments.service.js');
      await this.moduleRef.get(PaymentsService, { strict: false }).announceGrooming(bookingId);
    }
    return this.getById(bookingId, customerId, 'customer');
  }

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

    return { data: data.map(stripBookingPasswordHashes), total, page, pageSize };
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

    return { data: data.map(stripBookingPasswordHashes), total, page, pageSize };
  }

  async getById(bookingId: string, requesterId: string, requesterRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { include: { profile: true } },
        pet: { include: { careNotes: { orderBy: { createdAt: 'desc' } } } },
        partner: { include: { user: { include: { profile: true } } } },
        address: true,
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

    return { ...stripBookingPasswordHashes(booking), dispatch: await this.dispatchInfo(booking) };
  }

  private async dispatchInfo(b: { assignmentMode: 'any' | 'specific'; requestedPartnerId: string | null; requestExpiresAt: Date | null; requestOutcome: string | null }) {
    let requestedPartnerName: string | null = null;
    if (b.requestedPartnerId) {
      const prof = await this.prisma.userProfile.findUnique({ where: { userId: b.requestedPartnerId }, select: { firstName: true, lastName: true } });
      requestedPartnerName = prof ? `${prof.firstName} ${prof.lastName}`.trim() : null;
    }
    return {
      mode: b.assignmentMode,
      state: dispatchState(b),
      requestedPartnerId: b.requestedPartnerId,
      requestedPartnerName,
      expiresAt: b.requestExpiresAt,
      ttlMinutes: directRequestTtlMinutes(),
    };
  }

  async createGroomingBooking(customerId: string, data: {
    petId: string; packageId: string; addOnIds?: string[];
    scheduledAt: string; addressId: string; notes?: string;
    couponCode?: string; paymentMethod: string; channel?: string;
    assignmentMode?: string; requestedPartnerId?: string;
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
    if (!pkg.applicableSpecies.includes(pet.species)) {
      throw new UnprocessableEntityException({
        code: 'SPECIES_NOT_SUPPORTED',
        message: `This package is not available for ${pet.species}s`,
      });
    }

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
    const route = await this.resolveDispatch(data, { type: 'grooming', species: pet.species, city: address.city });

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
        petSpecies: pet.species,
        petBreed: pet.breed,
        petSize: pet.size,
        petCareNotes: careNote?.note ?? null,
        ...route,
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
    assignmentMode?: string; requestedPartnerId?: string;
  }) {
    const pet = await this.prisma.pet.findFirst({ where: { id: data.petId, customerId } });
    if (!pet) throw new NotFoundException('Pet not found');
    if (!speciesSupportsService(pet.species, 'walking')) {
      throw new UnprocessableEntityException({
        code: 'SPECIES_NOT_SUPPORTED',
        message: `Walks are only available for dogs. ${pet.name} can be booked for grooming.`,
      });
    }

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

    const route = await this.resolveDispatch(data, { type: 'walking', species: pet.species, city: address.city });
    const careNote = await this.prisma.petCareNote.findFirst({
      where: { petId: data.petId },
      orderBy: { createdAt: 'desc' },
    });

    const booking = await this.prisma.booking.create({
      data: {
        ...route,
        type: 'walking' as BookingType,
        status: (data.scheduleNow ? 'searching_partner' : 'confirmed') as BookingStatus,
        customerId,
        petId: data.petId,
        petName: pet.name,
        petSpecies: pet.species,
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
