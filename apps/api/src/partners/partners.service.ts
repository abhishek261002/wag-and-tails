import { Logger, Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { DispatchService, claimableBy } from '../bookings/dispatch.service.js';
import { CommissionService } from '../commission/commission.service.js';
import { TrackingService } from '../routing/tracking.service.js';
import { isLocationFilteringEnabled } from '../common/feature-flags.js';
import { normalizeCity } from '../common/city.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { BookingType, PartnerStatus, PetSpecies, Prisma } from '@prisma/client';

const MAX_JOB_PHOTOS = 10;
// Photos come from our own upload endpoint (/files/upload -> /uploads/...); never accept device-local URIs.
const isStoredPhotoUrl = (u: unknown): u is string =>
  typeof u === 'string' && u.length <= 500 && (/^\/uploads\/[\w.\-]+$/.test(u) || /^https:\/\/[^\s]+$/.test(u));

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private notificationsService: NotificationsService,
    private messagingService: MessagingService,
    private dispatch: DispatchService,
    private commission: CommissionService,
    private tracking: TrackingService
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
    const { passwordHash, ...user } = partner.user;
    const { aadhaarRefHash: _h, aadhaarNumber: _n, ...safe } = partner;
    return { ...safe, user };
  }

  // Partners may only change these fields themselves. Everything else (status, rating, KYC data,
  // approval fields, job counts...) is controlled by staff or the system, so the request body is
  // whitelisted field by field instead of being handed to Prisma as-is.
  async updateProfile(partnerId: string, body: Record<string, unknown>) {
    const data: Prisma.PartnerProfileUpdateInput = {};
    const str = (v: unknown, max: number, field: string) => {
      if (typeof v !== 'string' || v.length > max) throw new BadRequestException(`${field} is invalid`);
      return v.trim();
    };

    if (body['serviceRadiusKm'] !== undefined) {
      const n = Number(body['serviceRadiusKm']);
      if (!Number.isInteger(n) || n < 1 || n > 50) throw new BadRequestException('serviceRadiusKm must be between 1 and 50');
      data.serviceRadiusKm = n;
    }
    if (body['modes'] !== undefined) {
      const modes = body['modes'];
      if (!Array.isArray(modes) || modes.length === 0 || !modes.every((m) => m === 'grooming' || m === 'walking')) {
        throw new BadRequestException('modes must be a non-empty list of grooming/walking');
      }
      data.modes = Array.from(new Set(modes as string[]));
    }
    if (body['petSpecies'] !== undefined) {
      const sp = body['petSpecies'];
      if (!Array.isArray(sp) || sp.length === 0 || !sp.every((x) => x === 'dog' || x === 'cat')) {
        throw new BadRequestException('petSpecies must be a non-empty list of dog/cat');
      }
      data.petSpecies = Array.from(new Set(sp as string[]));
    }
    if (body['city'] !== undefined) data.city = str(body['city'], 80, 'city');
    if (body['bio'] !== undefined) data.bio = str(body['bio'], 500, 'bio');
    if (body['address'] !== undefined) data.address = str(body['address'], 300, 'address');
    if (body['photoUrl'] !== undefined) data.photoUrl = str(body['photoUrl'], 500, 'photoUrl');
    if (body['bankAccountNumber'] !== undefined) {
      const v = str(body['bankAccountNumber'], 20, 'bankAccountNumber');
      if (!/^\d{6,20}$/.test(v)) throw new BadRequestException('bankAccountNumber is invalid');
      data.bankAccountNumber = v;
    }
    if (body['ifscCode'] !== undefined) {
      const v = str(body['ifscCode'], 11, 'ifscCode').toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) throw new BadRequestException('ifscCode is invalid');
      data.ifscCode = v;
    }

    if (Object.keys(data).length === 0) throw new BadRequestException('Nothing to update');
    const updated = await this.prisma.partnerProfile.update({ where: { userId: partnerId }, data });
    const { aadhaarRefHash: _h, aadhaarNumber: _n, ...safe } = updated;
    return safe;
  }

  async setOnlineStatus(partnerId: string, online: boolean) {
    return this.prisma.partnerProfile.update({
      where: { userId: partnerId },
      data: { isOnline: online, lastSeenAt: new Date() },
    });
  }

  // One update per partner per second at most: a misbehaving client cannot flood the database or the sockets.
  private lastLocationAt = new Map<string, number>();

  async updateLocation(partnerId: string, lat: unknown, lng: unknown, heading?: unknown) {
    const la = Number(lat), ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180 || (la === 0 && ln === 0)) {
      throw new BadRequestException('lat and lng must be a valid position');
    }
    let hd: number | null = null;
    if (heading !== undefined && heading !== null) {
      const h = Number(heading);
      if (!Number.isFinite(h)) throw new BadRequestException('heading must be a number');
      // Devices report -1 when they have no heading.
      hd = h >= 0 && h <= 360 ? h : null;
    }
    const now = Date.now();
    if (now - (this.lastLocationAt.get(partnerId) ?? 0) < 1000) return;
    this.lastLocationAt.set(partnerId, now);
    if (this.lastLocationAt.size > 5000) this.lastLocationAt.delete(this.lastLocationAt.keys().next().value as string);

    await this.prisma.partnerProfile.update({ where: { userId: partnerId }, data: { currentLat: la, currentLng: ln } });
    await this.prisma.partnerLocation.upsert({
      where: { partnerId },
      update: { lat: la, lng: ln, heading: hd, updatedAt: new Date() },
      create: { partnerId, lat: la, lng: ln, heading: hd },
    });

    // Broadcast to whichever booking this partner is actively on, so the customer's tracking screen (and the
    // partner's own) updates live instead of polling. While the partner is heading there, the update carries
    // an ETA and the distance left, so the customer sees "arriving in 8 min" without asking.
    const activeBooking = await this.prisma.booking.findFirst({
      where: { partnerId, status: { in: ['assigned', 'accepted', 'partner_on_the_way', 'arrived', 'in_progress'] } },
      select: { id: true, status: true, address: { select: { lat: true, lng: true } } },
    });
    if (activeBooking) {
      const heading = ['assigned', 'accepted', 'partner_on_the_way'].includes(activeBooking.status);
      const eta = heading && activeBooking.address
        ? this.tracking.etaFor(activeBooking.id, { lat: la, lng: ln }, { lat: activeBooking.address.lat, lng: activeBooking.address.lng })
        : null;
      this.realtime.emitToBooking(activeBooking.id, 'partner:location_updated', {
        partnerId,
        bookingId: activeBooking.id,
        lat: la,
        lng: ln,
        heading: hd,
        timestamp: new Date().toISOString(),
        ...(eta ? { etaSeconds: Math.round(eta.seconds), distanceMeters: Math.round(eta.meters), etaApproximate: eta.approximate } : {}),
      });
    }
  }

  async getOpenJobs(partnerId: string) {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      include: { neighborhoods: true },
    });
    if (!partner || !partner.isOnline) return [];
    // A partner over their commission limit sees no jobs until they pay (see CommissionService).
    if (await this.commission.isBlocked(partnerId)) return [];

    // Jobs that need a partner and match this partner's mode and radius
    const validModes = partner.modes.filter((m): m is BookingType =>
      Object.values(BookingType).includes(m as BookingType)
    );

    const openBookings = await this.prisma.booking.findMany({
      where: {
        type: { in: validModes },
        // Cats are groomed only, and not every groomer takes cats.
        petSpecies: { in: (partner.petSpecies as PetSpecies[]) },
        status: 'needs_partner',
        partnerId: null,
        scheduledAt: { gte: new Date() },
        // Jobs a customer reserved for another partner are invisible to everyone else.
        ...claimableBy(partnerId),
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

    // City match, not radius: operations run per-city (Kanpur, Lucknow,
    // Delhi) — a partner sees every open job in their own city, full stop.
    const lat = partner.currentLat ?? null;
    const lng = partner.currentLng ?? null;
    const locationFilteringEnabled = isLocationFilteringEnabled();

    return openBookings
      .filter((b) => {
        // v1/dev bypass: every open job is visible to every online,
        // mode-matched partner regardless of city. Set
        // ENABLE_LOCATION_FILTERING=true (or unset it) to restore the
        // real per-city matching below.
        if (!locationFilteringEnabled) return true;
        if (!b.address) return true;
        // No city on file for this partner yet — conservatively show
        // nothing rather than guess, rather than the old radius fallback
        // of "show it anyway" when location data was missing.
        if (!partner.city) return false;
        return normalizeCity(b.address.city) === normalizeCity(partner.city);
      })
      .map((b) => ({
        bookingId: b.id,
        type: b.type,
        petName: b.petName,
        petSpecies: b.petSpecies,
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
        isDirectRequest: b.assignmentMode === 'specific',
        requestExpiresAt: b.requestExpiresAt,
      }));
  }

  // The chosen partner declines a direct request. The customer is told and picks someone else.
  async rejectJob(bookingId: string, partnerId: string) {
    const res = await this.prisma.booking.updateMany({
      where: {
        id: bookingId,
        assignmentMode: 'specific',
        requestedPartnerId: partnerId,
        partnerId: null,
        requestOutcome: null,
        status: { in: ['needs_partner', 'searching_partner'] },
      },
      data: { requestOutcome: 'rejected' },
    });
    if (res.count === 0) throw new NotFoundException('No pending request from this customer for you');
    await this.dispatch.notifyRejected(bookingId);
    return { rejected: true };
  }

  async claimJob(bookingId: string, partnerId: string) {
    const [partner, booking] = await Promise.all([
      this.prisma.partnerProfile.findUnique({ where: { userId: partnerId } }),
      this.prisma.booking.findUnique({ where: { id: bookingId }, include: { address: true } }),
    ]);
    if (!partner || partner.status !== 'approved') {
      throw new ForbiddenException('Your account must be approved before you can accept jobs');
    }
    await this.commission.assertCanTakeJobs(partnerId);
    if (!booking || booking.status !== 'needs_partner' || booking.partnerId) {
      throw new ConflictException({ code: 'JOB_TAKEN', message: 'This job is no longer available' });
    }
    if (!partner.modes.includes(booking.type)) {
      throw new ForbiddenException(`Your profile is not set up for ${booking.type} jobs`);
    }
    if (booking.assignmentMode === 'specific' && booking.requestedPartnerId !== partnerId) {
      throw new ConflictException({ code: 'JOB_RESERVED', message: 'The customer chose another partner for this job' });
    }
    if (!(partner.petSpecies as string[]).includes(booking.petSpecies)) {
      throw new ForbiddenException(`You do not take ${booking.petSpecies} bookings`);
    }
    if (isLocationFilteringEnabled() && booking.address && partner.city && normalizeCity(booking.address.city) !== normalizeCity(partner.city)) {
      throw new ForbiddenException('This job is outside your service city');
    }

    // Conditional update: of any number of partners tapping "Accept" at once, exactly one row matches.
    const startOtp = generateOtp();
    const claimed = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'needs_partner', partnerId: null, ...claimableBy(partnerId) },
      data: { partnerId, status: 'assigned', startOtp },
    });
    if (claimed.count === 0) {
      throw new ConflictException({ code: 'JOB_TAKEN', message: 'Another partner just accepted this job' });
    }
    await this.prisma.bookingStatusHistory.create({
      data: { bookingId, status: 'assigned', changedBy: partnerId, note: 'Partner claimed job' },
    });
    // Price the job for this partner (their discount, if valid right now, and their commission split).
    await this.commission.applyClaimPricing(bookingId, partnerId);
    const updated = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await this.notifyAssigned(bookingId, partnerId);
    // Chat opens the moment a job is claimed, not on-demand when someone
    // first opens the messaging screen — so both sides can message from
    // the instant the partner is assigned.
    await this.messagingService.getOrCreateConversation(bookingId, partnerId);
    return updated;
  }

  // Before-photos must be on file before the start code can be entered. Photos are uploaded through
  // /files/upload first; this attaches their stored URLs to the booking.
  async addBeforePhotos(bookingId: string, partnerId: string, urls: unknown) {
    if (!Array.isArray(urls) || urls.length === 0 || !urls.every(isStoredPhotoUrl)) {
      throw new BadRequestException('Send the uploaded photo URLs');
    }
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, partnerId, status: { in: ['assigned', 'partner_on_the_way', 'arrived'] } },
      select: { beforePhotos: true },
    });
    if (!booking) throw new NotFoundException('Job not found or not open for photos');
    const merged = [...new Set([...booking.beforePhotos, ...urls])];
    if (merged.length > MAX_JOB_PHOTOS) throw new BadRequestException(`At most ${MAX_JOB_PHOTOS} before-photos per job`);
    const updated = await this.prisma.booking.update({ where: { id: bookingId }, data: { beforePhotos: merged }, select: { beforePhotos: true } });
    return { beforePhotos: updated.beforePhotos };
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
    // Photo first, code second: proves the pet's condition on arrival before any work starts.
    if (booking.beforePhotos.length === 0) {
      throw new ConflictException({ code: 'BEFORE_PHOTO_REQUIRED', message: "Take a photo of the pet before starting the session" });
    }
    if (!booking.startOtp || booking.startOtp !== otp) {
      throw new BadRequestException('Incorrect code');
    }

    // Generated now rather than at assignment, since it must stay secret
    // from the customer until the session actually starts — the walking
    // screens additionally hold their own display back until the planned
    // duration elapses (see WalkingBookingStatus handling client-side).
    const endOtp = generateOtp();
    const sessionStartedAt = new Date();

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'in_progress',
        startOtp: null,
        endOtp,
        sessionStartedAt,
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
        data: { bookingId, partnerId, startedAt: sessionStartedAt },
      });
    }

    this.realtime.emitToBooking(bookingId, 'booking:status_changed', {
      bookingId,
      status: 'in_progress',
      partnerId,
      endOtp,
      sessionStartedAt: sessionStartedAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
    return updated;
  }

  // COD-style: for a booking the customer has not paid online, the partner confirms they received the
  // money (cash or UPI, for the full amount) before the job can be completed. That confirmation is what
  // makes the company's commission due (see CommissionService.settle).
  async collectPayment(bookingId: string, partnerId: string, method: unknown) {
    if (method !== 'cash' && method !== 'upi') throw new BadRequestException('method must be "cash" or "upi"');
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, partnerId, status: 'in_progress' } });
    if (!booking) throw new NotFoundException('Active job not found');
    if (booking.paymentStatus === 'paid' && !booking.collectedAt) {
      throw new ConflictException({ code: 'ALREADY_PAID_ONLINE', message: 'The customer already paid online. Nothing to collect.' });
    }
    // Only the first confirmation counts; a double tap is a no-op.
    const res = await this.prisma.booking.updateMany({
      where: { id: bookingId, partnerId, collectedAt: null, paymentStatus: { not: 'paid' } },
      data: { collectedAt: new Date(), collectedMethod: method, collectedAmount: booking.total, paymentStatus: 'paid' },
    });
    const updated = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (res.count > 0) {
      this.realtime.emitToBooking(bookingId, 'booking:payment_collected', {
        bookingId, amount: Number(updated.total), method, collectedAt: updated.collectedAt!.toISOString(),
      });
      await this.notificationsService.sendPush(booking.customerId, {
        title: 'Payment received',
        body: `Your partner marked ₹${Number(updated.total)} as received (${method === 'cash' ? 'cash' : 'UPI'}). Thank you!`,
        data: { type: 'booking:payment_collected', bookingId },
      }).catch(() => {});
    }
    return { collected: true, amount: Number(updated.total), method: updated.collectedMethod };
  }

  async completeJob(bookingId: string, partnerId: string, data: {
    otp: string; checklistItems: string[]; afterPhotos: string[];
  }) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, partnerId, status: 'in_progress' },
    });
    if (!booking) throw new NotFoundException('Active job not found');
    if (!booking.endOtp || booking.endOtp !== data.otp) {
      throw new BadRequestException('Incorrect code');
    }
    // Unpaid (pay-after-service) jobs cannot be closed until the partner has confirmed the payment.
    if (booking.paymentStatus !== 'paid') {
      throw new ConflictException({
        code: 'PAYMENT_NOT_COLLECTED',
        message: `Collect ₹${Number(booking.total)} from the customer and mark it received before completing the job`,
        amount: Number(booking.total),
      });
    }
    if (!Array.isArray(data.afterPhotos) || data.afterPhotos.length === 0) {
      throw new BadRequestException('At least one after-photo is required to complete the job');
    }
    if (data.afterPhotos.length > MAX_JOB_PHOTOS || !data.afterPhotos.every(isStoredPhotoUrl)) {
      throw new BadRequestException('After-photos must be uploaded before completing the job');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        endOtp: null,
        afterPhotos: data.afterPhotos,
        checklistCompleted: data.checklistItems,
        statusHistory: {
          create: { status: 'completed', changedBy: partnerId, note: 'Job completed' },
        },
      },
    });

    // Post the finished job to the money books (commission owed, or online payout). Idempotent; a failure
    // here is retried by CommissionService.reconcile and must not fail the completion itself.
    await this.commission.settle(bookingId).catch((e) => this.logger.error(`settle failed for ${bookingId}: ${e.message}`));

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
    return this.commission.getEarnings(partnerId);
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

    // Never expose the Aadhaar hash or any legacy plaintext number; only the last 4 digits leave the server.
    const safeData = data.map((p) => {
      const { passwordHash, ...user } = p.user;
      const { aadhaarRefHash: _h, aadhaarNumber: _n, ...safe } = p;
      return { ...safe, user };
    });

    return { data: safeData, total, page, pageSize };
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
