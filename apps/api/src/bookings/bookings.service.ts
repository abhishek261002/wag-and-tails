import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
  ConflictException,
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
import { BUSINESS_CONFIG } from '../common/config.js';
import { speciesSupportsService } from '../common/species.js';
import { isBefore, addHours } from 'date-fns';
import { scheduleProblem, SCHEDULE_PROBLEM_MESSAGE } from '../common/scheduling.js';
import { BookingType, BookingStatus, BookingChannel, PaymentMethod, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { WpBookingsService } from '../wp/wp-bookings.service.js';
import { WpJobsService } from '../wp/wp-jobs.service.js';
import { WpOutboxService } from '../wp/wp-outbox.service.js';
import { appRules, dateToIst, escalationDeadline } from '../wp/wp-link.js';

// App customers may cancel or move a website-linked booking themselves up to this many hours before it (decision 6A;
// set in the website's admin panel, or APP_SELF_SERVICE_CUTOFF_HOURS).
export const selfServiceCutoffHours = () => Number(process.env['APP_SELF_SERVICE_CUTOFF_HOURS'] ?? appRules().cancelHours);

/** "3 years" / "8 months" from a date of birth, for the website booking record. */
function ageText(dob: Date | null | undefined): string {
  if (!dob) return '';
  const months = Math.max(0, Math.floor((Date.now() - dob.getTime()) / (30.44 * 86_400_000)));
  return months >= 24 ? `${Math.floor(months / 12)} years` : months >= 12 ? '1 year' : `${Math.max(1, months)} months`;
}

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

// What a customer may see of the partner on their booking. The partner profile row also holds KYC data (Aadhaar
// hash, date of birth, address), bank details and commission terms, none of which a customer should receive.
// The phone number is shared only while the job is active (for the Call button), and the partner's position only
// while they are on the way.
const PARTNER_PHONE_VISIBLE: string[] = ['assigned', 'accepted', 'partner_on_the_way', 'arrived', 'in_progress'];
function customerSafePartner<T extends { status: string; partner?: any }>(booking: T): T {
  const p = booking.partner;
  if (!p) return booking;
  const showPhone = PARTNER_PHONE_VISIBLE.includes(booking.status);
  const showLocation = booking.status === 'partner_on_the_way';
  const prof = p.user?.profile;
  return {
    ...booking,
    partner: {
      userId: p.userId,
      photoUrl: p.photoUrl ?? null,
      bio: p.bio ?? null,
      rating: p.rating,
      reviewCount: p.reviewCount,
      completedJobs: p.completedJobs,
      city: p.city ?? null,
      currentLat: showLocation ? p.currentLat ?? null : null,
      currentLng: showLocation ? p.currentLng ?? null : null,
      user: p.user
        ? {
            id: p.user.id,
            ...(showPhone ? { phone: p.user.phone } : {}),
            profile: prof ? { firstName: prof.firstName, lastName: prof.lastName, avatarUrl: prof.avatarUrl ?? null } : null,
          }
        : undefined,
    },
  } as T;
}

// Fields of a booking that are the company's and the partner's business, never the customer's: the commission split,
// settlement, and everything the booking desk uses to chase a job (timers, flags, the website revision, the public
// tracking token). Removed from every response a customer receives.
const INTERNAL_BOOKING_FIELDS = [
  'commissionPct', 'commissionAmount', 'partnerShareAmount', 'settledAt',
  'escalateAt', 'escalatedAt', 'staffFlag', 'staffFlagNote', 'staffFlagAt', 'reconfirmBy', 'lateFlaggedAt', 'noShowPhoto',
  'trackToken', 'wpRev', 'wpStatus',
] as const;
function stripInternalForCustomer<T extends object>(booking: T): T {
  const out: any = { ...booking };
  for (const k of INTERNAL_BOOKING_FIELDS) delete out[k];
  return out;
}

// Booking lists by meaning, for the apps' Home and Bookings screens:
//  live     = a partner is being found or is on the job (Home "Happening now")
//  upcoming = not finished yet (Bookings > Upcoming)
//  past     = finished one way or another (Bookings > Past)
const LIVE_STATUSES: BookingStatus[] = ['needs_partner', 'searching_partner', 'assigned', 'accepted', 'partner_on_the_way', 'arrived', 'in_progress'];
const UPCOMING_STATUSES: BookingStatus[] = ['confirmed', ...LIVE_STATUSES];
const PAST_STATUSES: BookingStatus[] = ['completed', 'cancelled', 'refunded', 'expired'];

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
    private dispatch: DispatchService,
    private moduleRef: ModuleRef,
    private routing: RoutingService,
    private wpBookings: WpBookingsService,
    private wpJobs: WpJobsService,
    private wpOutbox: WpOutboxService
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
    type?: string; status?: string; scope?: string; petId?: string; page?: number; pageSize?: number;
  } = {}) {
    const { type, status, scope, petId } = filters;
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    if (type && !['grooming', 'walking'].includes(type)) throw new BadRequestException('type must be grooming or walking');
    if (petId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(petId)) throw new BadRequestException('petId is not valid');
    if (status && !(status in BookingStatus)) throw new BadRequestException('Unknown status');
    if (scope && !['live', 'upcoming', 'past'].includes(scope)) throw new BadRequestException('scope must be live, upcoming or past');

    const scopeStatuses = scope === 'live' ? LIVE_STATUSES
      : scope === 'upcoming' ? UPCOMING_STATUSES
      : scope === 'past' ? PAST_STATUSES
      : undefined;

    const where: Prisma.BookingWhereInput = {
      customerId,
      ...(type ? { type: type as BookingType } : {}),
      ...(petId ? { petId } : {}),
      ...(status ? { status: status as BookingStatus } : scopeStatuses ? { status: { in: scopeStatuses } } : {}),
    };
    // Upcoming reads soonest first; everything else newest first.
    const orderBy: Prisma.BookingOrderByWithRelationInput = scope === 'upcoming' ? { scheduledAt: 'asc' } : scope === 'past' ? { scheduledAt: 'desc' } : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          pet: true,
          partner: { include: { user: { include: { profile: true } } } },
          addOns: { include: { addOn: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data: data.map((b) => stripInternalForCustomer(customerSafePartner(stripBookingPasswordHashes(b)))), total, page, pageSize };
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

    const safe = stripBookingPasswordHashes(booking);
    return { ...(requesterRole === 'customer' ? stripInternalForCustomer(customerSafePartner(safe)) : safe), dispatch: await this.dispatchInfo(booking) };
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

  /** Refuses a booking time that is in the past, too soon to staff, or too far ahead (same rule the apps use to offer slots). */
  private assertSchedulable(scheduledAt: unknown): Date {
    const at = new Date(scheduledAt as string);
    const problem = scheduleProblem(at);
    if (problem) {
      throw new BadRequestException({ code: 'SLOT_UNAVAILABLE', reason: problem, message: SCHEDULE_PROBLEM_MESSAGE[problem] });
    }
    return at;
  }

  async createGroomingBooking(customerId: string, data: {
    petId: string; packageId: string; addOnIds?: string[];
    scheduledAt: string; addressId: string; notes?: string;
    couponCode?: string; paymentMethod: string; channel?: string;
    assignmentMode?: string; requestedPartnerId?: string;
    usePoints?: boolean; expectTotal?: number; cityId?: string;
  }) {
    const scheduledAt = this.assertSchedulable(data.scheduledAt);

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

    // Website connected: the slot is reserved on the website first and priced there (B3).
    if (this.wpBookings.enabled && pkg.wpId) {
      return this.createLinkedGrooming(customerId, data, { pet, address, pkg: { ...pkg, wpId: pkg.wpId }, addOns, scheduledAt });
    }

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
        scheduledAt,
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
    // An on-demand walk starts now; a scheduled one must be a real future slot.
    const walkAt = data.scheduleNow ? new Date() : this.assertSchedulable(data.scheduledAt);
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
    // Walks run only where the website's walking switch is on (decision 11A).
    if (this.wpBookings.enabled) {
      const city = await this.wpBookings.cityFor(address.city);
      if (!city?.walking) {
        throw new UnprocessableEntityException({ code: 'WALKING_NOT_AVAILABLE', message: `Dog walking is not available in ${address.city} yet.` });
      }
    }

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
        scheduledAt: walkAt,
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
    await this.wpBookings.walkChanged(booking.id, 'Booked');

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
    const newTime = this.assertSchedulable(scheduledAt);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.wpRef) return this.rescheduleLinked(booking, newTime, reason);
    if (!['confirmed', 'needs_partner', 'assigned'].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be rescheduled in current status');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        scheduledAt: newTime,
        statusHistory: {
          create: { status: booking.status, changedBy: customerId, note: `Rescheduled: ${reason ?? 'no reason'}` },
        },
      },
    });
  }

  /** The customer's own review of a booking, or null if they have not rated it yet. */
  async getReview(bookingId: string, customerId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, customerId }, select: { id: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    const r = await this.prisma.review.findUnique({ where: { bookingId } });
    return r ? { rating: r.rating, comment: r.comment, createdAt: r.createdAt } : null;
  }

  /**
   * The customer rates the partner once a booking is completed (1 to 5 stars, optional comment). One review per
   * booking. The partner's average rating and review count are recalculated from all their reviews, so they can
   * never drift from the real ones.
   */
  async addReview(bookingId: string, customerId: string, input: { rating?: unknown; comment?: unknown }) {
    const rating = Number(input?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('Rating must be a whole number from 1 to 5');
    const comment = typeof input?.comment === 'string' ? input.comment.trim().slice(0, 500) : '';

    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, customerId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'completed') throw new ConflictException('You can rate a booking once it is completed.');
    const partnerId = booking.partnerId;
    if (!partnerId) throw new UnprocessableEntityException('This booking had no partner to rate.');

    const prof = await this.prisma.userProfile.findUnique({ where: { userId: customerId }, select: { firstName: true, lastName: true } });
    const reviewerName = [prof?.firstName, prof?.lastName?.charAt(0) ? `${prof.lastName.charAt(0)}.` : ''].filter(Boolean).join(' ') || 'Customer';

    try {
      return await this.prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
          data: { bookingId, reviewerId: customerId, reviewerName, revieweeId: partnerId, revieweeType: 'partner', rating, comment: comment || null },
        });
        const agg = await tx.review.aggregate({ where: { revieweeId: partnerId, revieweeType: 'partner' }, _avg: { rating: true }, _count: { _all: true } });
        await tx.partnerProfile.update({
          where: { userId: partnerId },
          data: { rating: Math.round((agg._avg.rating ?? rating) * 100) / 100, reviewCount: agg._count._all },
        });
        return { rating: review.rating, comment: review.comment, createdAt: review.createdAt };
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('You have already rated this booking.');
      throw e;
    }
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
    // Website-linked booking: app customers cancel themselves only until the cut-off; after that the desk decides.
    if (requesterRole === 'customer' && booking.wpRef) this.assertSelfService(booking.scheduledAt, booking.status, 'cancel');

    const updated = await this.transition(bookingId, 'cancelled', requesterId, requesterRole, reason);
    if (booking.wpRef) await this.wpJobs.cancelled(bookingId, reason || 'No reason given', requesterRole === 'customer' ? 'Customer (app)' : requesterRole);
    if (booking.type === 'walking') await this.wpBookings.walkChanged(bookingId, 'Cancelled');
    if (booking.partnerId) {
      await this.wpJobs.tellPartner(booking.partnerId, bookingId, 'job:removed', 'Booking cancelled', `${booking.petName}'s ${booking.type} was cancelled${reason ? ': ' + reason : ''}.`, { status: 'cancelled' });
    }
    return updated;
  }

  private assertSelfService(scheduledAt: Date | null, status: string, what: 'cancel' | 'move') {
    if (!['pending_payment', 'confirmed', 'needs_partner', 'assigned', 'accepted'].includes(status)) {
      throw new BadRequestException(`This booking can no longer be ${what === 'cancel' ? 'cancelled' : 'moved'} in the app. Please call or WhatsApp us.`);
    }
    if (scheduledAt && scheduledAt.getTime() - Date.now() < selfServiceCutoffHours() * 3600_000) {
      throw new ForbiddenException({
        code: 'SELF_SERVICE_CLOSED',
        message: `Bookings can be ${what === 'cancel' ? 'cancelled' : 'moved'} in the app up to ${selfServiceCutoffHours()} hours before. Please call or WhatsApp us and we will help.`,
      });
    }
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
        staffFlag: null, staffFlagNote: null,
        statusHistory: {
          create: { status: 'assigned', changedBy: staffId, note: `Partner assigned by staff` },
        },
      },
    });
    await this.wpJobs.jobChanged(bookingId, { transition: true });
  }

  // ── Website-linked grooming (B3) ──────────────────────────────────────────────

  private async createLinkedGrooming(
    customerId: string,
    data: { petId: string; packageId: string; notes?: string; couponCode?: string; paymentMethod: string; assignmentMode?: string; requestedPartnerId?: string; usePoints?: boolean; expectTotal?: number; cityId?: string },
    ctx: { pet: any; address: any; pkg: { id: string; name: string; price: Prisma.Decimal; wpId: string }; addOns: { id: string; name: string; price: Prisma.Decimal }[]; scheduledAt: Date }
  ) {
    const { pet, address, pkg, addOns, scheduledAt } = ctx;
    const city = await this.wpBookings.requireCity(address.city, data.cityId);
    if (!/^\d{6}$/.test(String(address.pincode ?? ''))) {
      throw new UnprocessableEntityException({ code: 'ADDRESS_INCOMPLETE', message: 'Add the 6-digit pincode to this address first.' });
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: customerId }, include: { profile: true } });
    const route = await this.resolveDispatch(data, { type: 'grooming', species: pet.species, city: address.city });
    const careNote = await this.prisma.petCareNote.findFirst({ where: { petId: pet.id }, orderBy: { createdAt: 'desc' } });
    const id = randomUUID();
    const payOnline = data.paymentMethod !== 'cash_after_service';
    const name = user.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : 'App customer';
    const addressText = [address.line1, address.line2, address.city].filter(Boolean).join(', ');

    const rec = await this.wpBookings.reserve({
      jobId: id, cityId: city.id, pkgWpId: pkg.wpId, petType: pet.species === 'cat' ? 'Cat' : 'Dog', petName: pet.name, breed: pet.breed,
      gender: pet.sex === 'female' ? 'Female' : 'Male', age: ageText(pet.dateOfBirth), aggression: pet.temperament,
      name: name.length >= 2 ? name : 'App customer', email: user.email, phone: user.phone, address: addressText, pincode: String(address.pincode),
      lat: address.lat, lng: address.lng, scheduledAt, coupon: data.couponCode ?? null, usePts: !!data.usePoints,
      notes: [data.notes, careNote?.note].filter(Boolean).join(' · ') || null,
      extras: addOns.map((a) => ({ name: a.name, price: Number(a.price) })), payOnline,
      expectTotal: typeof data.expectTotal === 'number' ? data.expectTotal : null,
    });

    const discount = Number(rec.discount ?? 0) + Number(rec.ptsDiscount ?? 0);
    try {
      return await this.prisma.booking.create({
        data: {
          id,
          type: 'grooming' as BookingType,
          status: 'pending_payment' as BookingStatus,
          customerId,
          petId: pet.id, petName: pet.name, petSpecies: pet.species, petBreed: pet.breed, petSize: pet.size,
          petCareNotes: careNote?.note ?? null,
          petAggression: rec.aggression ?? null,
          ...route,
          packageId: pkg.id, packageName: pkg.name, packagePrice: Number(rec.subtotal ?? pkg.price) - addOns.reduce((s, a) => s + Number(a.price), 0),
          scheduledAt,
          addressId: address.id,
          addressLine: `${address.line1}, ${address.city}`,
          channel: 'app' as BookingChannel,
          notes: data.notes ?? null,
          subtotal: Number(rec.subtotal ?? 0),
          discount,
          total: Number(rec.total ?? 0),
          couponCode: rec.coupon || null,
          paymentMethod: data.paymentMethod as PaymentMethod,
          paymentStatus: 'pending' as const,
          wpRef: rec.id, wpRev: Number(rec._rev) || null, wpSource: 'App', wpCityId: city.id, wpStatus: rec.status ?? null,
          addOns: { create: addOns.map((a) => ({ addOnId: a.id, name: a.name, price: a.price })) },
          statusHistory: { create: { status: 'pending_payment', changedBy: customerId, note: `Reserved on the website as ${rec.id}` } },
        },
        include: { addOns: { include: { addOn: true } }, pet: true },
      });
    } catch (e) {
      // The slot is held on the website but our job could not be saved: release it so nobody is blocked.
      await this.wpOutbox.enqueue('action', `action:${id}:cancel`, { path: `bookings/${rec.id}/action`, body: { action: 'cancel', reason: 'Other', details: 'App booking could not be completed', actor: 'App' } }, null);
      throw e;
    }
  }

  private async rescheduleLinked(booking: { id: string; wpRef: string | null; status: string; scheduledAt: Date | null; partnerId: string | null; customerId: string; packageId: string | null; petName: string }, newTime: Date, reason?: string) {
    this.assertSelfService(booking.scheduledAt, booking.status, 'move');
    if (booking.scheduledAt && booking.scheduledAt.getTime() === newTime.getTime()) {
      throw new BadRequestException({ code: 'SAME_TIME', message: 'That is the time you already have. Please pick a different time.' });
    }
    // The new time must be free on the website's calendar (this booking itself does not count).
    const pkg = booking.packageId ? await this.prisma.groomingPackage.findUnique({ where: { id: booking.packageId }, select: { wpId: true } }) : null;
    const full = await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { address: true } });
    const { date, start } = dateToIst(newTime);
    const res = await this.wpBookings.slots(full.wpCityId ?? '', date, pkg?.wpId ?? null, null, booking.wpRef);
    const slot = (res.slots ?? []).find((s) => s.start === start);
    if (!slot || !slot.free) throw new ConflictException({ code: 'SLOT_TAKEN', message: 'That time is not free. Please choose another slot.' });

    const keepPartner = !!booking.partnerId && ['assigned', 'accepted'].includes(booking.status);
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        scheduledAt: newTime,
        lateFlaggedAt: null,
        ...(keepPartner ? { reconfirmBy: new Date(Date.now() + appRules().reconfirmHours * 3600_000) } : {}),
        ...(booking.status === 'needs_partner' ? { escalateAt: escalationDeadline(new Date(), newTime), escalatedAt: null } : {}),
        statusHistory: { create: { status: booking.status, changedBy: booking.customerId, note: `Rescheduled by the customer: ${reason ?? 'no reason'}` } },
      },
    });
    await this.wpJobs.rescheduled(booking.id, reason ?? 'Moved by the customer in the app');
    if (keepPartner) {
      await this.wpJobs.tellPartner(booking.partnerId!, booking.id, 'job:updated', 'Job rescheduled',
        `${booking.petName}'s grooming moved to ${date} ${start}. Please confirm the new time within ${appRules().reconfirmHours} hours.`, { changes: ['time'], reconfirmBy: updated.reconfirmBy });
    } else if (booking.status === 'needs_partner') {
      await this.wpJobs.announce(booking.id);
    }
    return updated;
  }
}
