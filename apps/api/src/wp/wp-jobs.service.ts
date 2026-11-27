import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RoutingService } from '../routing/routing.service.js';
import { WpClientService } from './wp-client.service.js';
import { WpOutboxService } from './wp-outbox.service.js';
import { FLAG_TEXT, appRules, dateToIst, escalationDeadline, jobStatusFor } from './wp-link.js';

// The app side of a linked booking: tells the plugin (desk card, WhatsApp) what the job is doing, and runs the
// timers the desk relies on (B4, B5, B7). Every call is a no-op for bookings without a plugin link.

const ACTIVE_PARTNER_STATUSES = ['assigned', 'accepted', 'partner_on_the_way', 'arrived', 'in_progress'];

export function publicTrackUrl(token: string | null | undefined): string | null {
  if (!token) return null;
  const base = (process.env['PUBLIC_API_URL'] ?? process.env['API_URL'] ?? 'http://localhost:3001').replace(/\/+$/, '');
  return `${base}/api/v1/track/${token}`;
}

/** History note of a job the partner gave up. Open jobs and claiming use it to leave that partner out. */
export const RELEASED_NOTE = 'Released by the partner:';

@Injectable()
export class WpJobsService {
  private readonly logger = new Logger(WpJobsService.name);

  constructor(
    private prisma: PrismaService,
    private wp: WpClientService,
    private outbox: WpOutboxService,
    private realtime: RealtimeGateway,
    private notifications: NotificationsService,
    private routing: RoutingService,
    private moduleRef: ModuleRef
  ) {}

  private async load(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { partner: { include: { user: { include: { profile: true } } } } },
    });
  }

  private partnerOut(b: NonNullable<Awaited<ReturnType<WpJobsService['load']>>>) {
    const p = b.partner;
    if (!p) return null;
    const name = p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}`.trim() : 'Partner';
    return { id: p.userId, name, phone: (p.user?.phone ?? '').replace(/^\+91/, ''), type: p.employmentType ?? '' };
  }

  /**
   * Push the job's current state to the desk card. `transition` = this is a real step (assigned, on the way,
   * started): website customers then get the matching WhatsApp (decisions 4A, 5A). Flag-only updates never message.
   */
  async jobChanged(bookingId: string, opts: { transition?: boolean; alert?: string; note?: string; etaMins?: number } = {}) {
    if (!this.wp.enabled) return;
    try {
      const b = await this.load(bookingId);
      if (!b?.wpRef) return;
      if (!b.trackToken && b.wpSource !== 'App') {
        const trackToken = randomBytes(12).toString('base64url');
        await this.prisma.booking.update({ where: { id: b.id }, data: { trackToken } });
        b.trackToken = trackToken;
      }
      const status = jobStatusFor(b);
      const forWebsiteCustomer = b.wpSource !== 'App';
      const notify = !!opts.transition && forWebsiteCustomer && ['assigned', 'on_the_way', 'in_progress'].includes(status);
      const flag = b.staffFlag ? `${FLAG_TEXT[b.staffFlag] ?? b.staffFlag}${b.staffFlagNote ? ': ' + b.staffFlagNote : ''}` : null;
      const body: Record<string, unknown> = {
        status,
        jobId: b.id,
        partner: this.partnerOut(b),
        flag,
        notify,
        trackUrl: forWebsiteCustomer && appRules().liveTracking ? publicTrackUrl(b.trackToken) : null,
      };
      if (opts.note !== undefined) body['note'] = opts.note;
      if (opts.etaMins !== undefined) body['etaMins'] = opts.etaMins;
      if (opts.alert) body['alert'] = opts.alert;
      if (status === 'on_the_way' && b.startOtp) body['startCode'] = b.startOtp;
      if (status === 'in_progress' && b.endOtp) body['endCode'] = b.endOtp;
      const key = opts.transition ? `job:${b.id}:${status}` : `job:${b.id}:update`;
      await this.outbox.enqueue('job', key, { path: `bookings/${b.wpRef}/job`, body }, b.id);
    } catch (e) {
      this.logger.error(`jobChanged(${bookingId}) failed: ${(e as Error).message}`);
    }
  }

  /** The partner finished the job: the plugin booking becomes Completed with the payment mode (points, WhatsApp). */
  async completed(bookingId: string) {
    if (!this.wp.enabled) return;
    const b = await this.load(bookingId);
    if (!b?.wpRef || b.wpStatus === 'Completed') return;
    const paidOnline = b.collectedAt == null && b.paymentStatus === 'paid' && b.paymentMethod !== 'cash_after_service';
    const mode = paidOnline || b.collectedMethod === 'upi' ? 'online' : 'cash';
    const p = this.partnerOut(b);
    await this.outbox.enqueue('action', `action:${b.id}:complete`, {
      path: `bookings/${b.wpRef}/action`,
      body: { action: 'complete', mode, actor: p?.name ?? '', note: `Completed in the partner app${p ? ' by ' + p.name : ''}` },
    }, b.id);
  }

  async cancelled(bookingId: string, reason: string, who: string) {
    if (!this.wp.enabled) return;
    const b = await this.load(bookingId);
    if (!b?.wpRef || b.wpStatus === 'Cancelled') return;
    await this.outbox.enqueue('action', `action:${b.id}:cancel`, {
      path: `bookings/${b.wpRef}/action`,
      body: { action: 'cancel', reason: 'Other', details: `${reason} (${who})`.slice(0, 400), actor: who },
    }, b.id);
  }

  async rescheduled(bookingId: string, reason: string) {
    if (!this.wp.enabled) return;
    const b = await this.load(bookingId);
    if (!b?.wpRef || !b.scheduledAt) return;
    const { date, start } = dateToIst(b.scheduledAt);
    await this.outbox.enqueue('action', `action:${b.id}:reschedule:${date}T${start}`, {
      path: `bookings/${b.wpRef}/action`,
      body: { action: 'reschedule', date, start, reason: reason.slice(0, 200), actor: 'Customer (app)' },
    }, b.id);
  }

  async paid(bookingId: string, payId: string) {
    if (!this.wp.enabled) return;
    const b = await this.load(bookingId);
    if (!b?.wpRef) return;
    await this.outbox.enqueue('action', `action:${b.id}:paid`, { path: `bookings/${b.wpRef}/paid`, body: { payId } }, b.id);
  }

  /** Raise (or clear with null) a problem the desk must handle; alerts the desk once per problem. */
  async flag(bookingId: string, flag: keyof typeof FLAG_TEXT | null, note?: string | null) {
    const b = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { staffFlag: flag, staffFlagNote: note ?? null, staffFlagAt: flag ? new Date() : null },
      select: { id: true, petName: true },
    });
    this.realtime.emitToRole('staff', 'booking:flag', { bookingId, flag, note: note ?? null });
    await this.jobChanged(b.id, flag ? { alert: `${FLAG_TEXT[flag]}${note ? ': ' + note : ''}` } : {});
  }

  /** Escalation time for a booking that is about to look for a partner (decision 2A). */
  escalationFor(createdAt: Date, scheduledAt: Date | null): Date | null {
    return scheduledAt ? escalationDeadline(createdAt, scheduledAt) : null;
  }

  // ── Timers (B5) ───────────────────────────────────────────────────────────────

  @Cron('*/1 * * * *')
  async tick() {
    if ((process.env['SCHEDULER_ENABLED'] ?? 'true') === 'false') return;
    await this.escalate().catch((e) => this.logger.error(`escalate: ${e.message}`));
    await this.directRequestFallback().catch((e) => this.logger.error(`fallback: ${e.message}`));
    await this.reconfirmLapsed().catch((e) => this.logger.error(`reconfirm: ${e.message}`));
    await this.runningLate().catch((e) => this.logger.error(`late: ${e.message}`));
    await this.confirmAbandonedPayLater().catch((e) => this.logger.error(`pay-later: ${e.message}`));
  }

  /**
   * A pay-after-service app booking is already Confirmed on the website (the customer got the WhatsApp). If the app
   * never sent its "pay after service" step (closed or crashed in between), confirm it here so it reaches partners.
   */
  async confirmAbandonedPayLater(now = new Date()) {
    const stuck = await this.prisma.booking.findMany({
      where: { status: 'pending_payment', paymentMethod: 'cash_after_service', wpRef: { not: null }, wpStatus: 'Confirmed', createdAt: { lte: new Date(now.getTime() - 10 * 60_000) } },
      select: { id: true, customerId: true },
      take: 50,
    });
    for (const b of stuck) {
      try {
        const { PaymentsService } = await import('../payments/payments.service.js');
        await this.moduleRef.get(PaymentsService, { strict: false }).confirmPayAfterService(b.customerId, b.id);
      } catch (e) {
        this.logger.warn(`Could not confirm pay-later booking ${b.id}: ${(e as Error).message}`);
      }
    }
    return stuck.length;
  }

  /** Nobody accepted in time: red card and desk alert. */
  async escalate(now = new Date()) {
    const due = await this.prisma.booking.findMany({
      where: { status: 'needs_partner', partnerId: null, escalatedAt: null, escalateAt: { lte: now } },
      select: { id: true },
      take: 100,
    });
    for (const b of due) {
      const res = await this.prisma.booking.updateMany({ where: { id: b.id, escalatedAt: null, partnerId: null }, data: { escalatedAt: now } });
      if (res.count) await this.flag(b.id, 'no_partner');
    }
    return due.length;
  }

  /**
   * Decision 3A: a customer's chosen partner who declines or does not answer in time → the job goes to everyone
   * (the customer is told), instead of waiting for the customer to choose again.
   */
  async directRequestFallback(now = new Date()) {
    const stuck = await this.prisma.booking.findMany({
      where: {
        status: 'needs_partner', partnerId: null, assignmentMode: 'specific',
        OR: [{ requestOutcome: { not: null } }, { requestExpiresAt: { lte: now } }],
      },
      select: { id: true, customerId: true, petName: true },
      take: 100,
    });
    for (const b of stuck) {
      const res = await this.prisma.booking.updateMany({
        where: { id: b.id, assignmentMode: 'specific', partnerId: null },
        data: { assignmentMode: 'any', requestedPartnerId: null, requestExpiresAt: null, requestOutcome: null },
      });
      if (!res.count) continue;
      await this.announce(b.id);
      await this.notifications.sendPush(b.customerId, {
        title: 'Finding another partner',
        body: `Your chosen partner is not available for ${b.petName}. We have asked all partners near you.`,
        data: { type: 'booking:dispatch_changed', bookingId: b.id },
      }).catch(() => {});
      this.realtime.emitToBooking(b.id, 'booking:dispatch_changed', { bookingId: b.id, state: 'open' });
      await this.jobChanged(b.id);
    }
    return stuck.length;
  }

  /** After a reschedule the partner did not confirm the new time: offer the job to everyone again. */
  async reconfirmLapsed(now = new Date()) {
    const lapsed = await this.prisma.booking.findMany({
      where: { reconfirmBy: { lte: now }, partnerId: { not: null }, status: { in: ['assigned', 'accepted'] } },
      select: { id: true, partnerId: true },
      take: 100,
    });
    for (const b of lapsed) {
      await this.unassign(b.id, b.partnerId!, 'reconfirm_lapsed', 'Did not confirm the new time');
    }
    return lapsed.length;
  }

  /** The partner has not started the trip although the job starts within 15 minutes (or already started). */
  async runningLate(now = new Date()) {
    const late = await this.prisma.booking.findMany({
      where: { status: { in: ['assigned', 'accepted'] }, lateFlaggedAt: null, scheduledAt: { lte: new Date(now.getTime() + 15 * 60_000) }, partnerId: { not: null } },
      select: { id: true, partnerId: true, petName: true },
      take: 100,
    });
    for (const b of late) {
      const res = await this.prisma.booking.updateMany({ where: { id: b.id, lateFlaggedAt: null }, data: { lateFlaggedAt: now } });
      if (!res.count) continue;
      await this.flag(b.id, 'late', 'Trip not started');
      await this.notifications.sendPush(b.partnerId!, {
        title: 'Start your trip',
        body: `${b.petName}'s grooming starts soon. Tap Start trip, or release the job if you cannot make it.`,
        data: { type: 'job:late', bookingId: b.id },
      }).catch(() => {});
    }
    return late.length;
  }

  /** On-the-way jobs: refresh the ETA on the desk card every few minutes. */
  @Cron('*/3 * * * *')
  async refreshEtas() {
    if (!this.wp.enabled || (process.env['SCHEDULER_ENABLED'] ?? 'true') === 'false') return;
    const moving = await this.prisma.booking.findMany({
      where: { status: 'partner_on_the_way', wpRef: { not: null } },
      include: { address: true, partner: { select: { currentLat: true, currentLng: true } } },
      take: 100,
    });
    for (const b of moving) {
      const eta = await this.etaMins(b).catch(() => null);
      if (eta != null) await this.jobChanged(b.id, { etaMins: eta });
    }
  }

  async etaMins(b: { address: { lat: number; lng: number } | null; partner: { currentLat: number | null; currentLng: number | null } | null }): Promise<number | null> {
    if (!b.address || b.partner?.currentLat == null || b.partner.currentLng == null || (b.address.lat === 0 && b.address.lng === 0)) return null;
    const r = await this.routing.getRoute({ lat: b.partner.currentLat, lng: b.partner.currentLng }, { lat: b.address.lat, lng: b.address.lng });
    return Math.max(1, Math.round(r.durationSeconds / 60));
  }

  // ── Shared steps ──────────────────────────────────────────────────────────────

  /** Take a job back from its partner and offer it to everyone again (release, lapsed reconfirm, desk change). */
  async unassign(bookingId: string, partnerId: string, flag: keyof typeof FLAG_TEXT | null, note: string, actorId?: string) {
    const res = await this.prisma.booking.updateMany({
      where: { id: bookingId, partnerId, status: { in: ['assigned', 'accepted', 'partner_on_the_way'] } },
      data: {
        partnerId: null, status: 'needs_partner', startOtp: null, reconfirmBy: null, lateFlaggedAt: null,
        assignmentMode: 'any', requestedPartnerId: null, requestExpiresAt: null, requestOutcome: null,
        partnerDiscountPct: null, partnerDiscountAmount: 0, discountSource: null,
        commissionPct: null, commissionAmount: null, partnerShareAmount: null,
        escalatedAt: null, escalateAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    if (!res.count) return false;
    await this.prisma.bookingStatusHistory.create({
      data: { bookingId, status: 'needs_partner', changedBy: actorId ?? partnerId, note: `${flag === 'released' ? RELEASED_NOTE : 'Partner removed:'} ${note}` },
    });
    // A partner discount may have lowered the price; the next partner prices the job again from the original.
    const b = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (Number(b.total) !== Number(b.subtotal) - Number(b.discount)) {
      await this.prisma.booking.update({ where: { id: bookingId }, data: { total: Number(b.subtotal) - Number(b.discount) } });
    }
    this.realtime.emitToUser(partnerId, 'job:removed', { bookingId });
    this.realtime.emitToBooking(bookingId, 'booking:status_changed', { bookingId, status: 'needs_partner', updatedAt: new Date().toISOString() });
    await this.notifications.sendPush(partnerId, {
      title: 'Job removed',
      body: `${b.petName}'s job is no longer yours (${note}).`,
      data: { type: 'job:removed', bookingId },
    }).catch(() => {});
    if (flag) await this.flag(bookingId, flag, note);
    else await this.jobChanged(bookingId, { transition: true });
    await this.announce(bookingId);
    return true;
  }

  /** Ring the partners for a job that needs one (same path as app bookings). */
  async announce(bookingId: string) {
    try {
      const { PaymentsService } = await import('../payments/payments.service.js');
      await this.moduleRef.get(PaymentsService, { strict: false }).announceGrooming(bookingId);
    } catch (e) {
      this.logger.error(`announce(${bookingId}) failed: ${(e as Error).message}`);
    }
  }

  /** Realtime event + push to one partner about one of their jobs. */
  async tellPartner(partnerId: string, bookingId: string, event: string, title: string, body: string, extra: Record<string, unknown> = {}) {
    this.realtime.emitToUser(partnerId, event, { bookingId, ...extra });
    await this.notifications.sendPush(partnerId, { title, body, data: { type: event, bookingId } }).catch(() => {});
  }

  isActivePartnerStatus(status: string) {
    return ACTIVE_PARTNER_STATUSES.includes(status);
  }
}
