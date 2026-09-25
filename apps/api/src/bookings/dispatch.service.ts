import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BUSINESS_CONFIG } from '@wag/config';

// How long a chosen partner has to answer a direct request before the customer is asked to choose again.
export const directRequestTtlMinutes = () => Number(process.env['DIRECT_REQUEST_TTL_MINUTES'] ?? 10);

export type DispatchState = 'open' | 'awaiting_partner' | 'rejected' | 'expired';

interface DispatchFields {
  assignmentMode: 'any' | 'specific';
  requestedPartnerId: string | null;
  requestExpiresAt: Date | null;
  requestOutcome: string | null;
}

/**
 * Where a booking is in the dispatch flow. `specific` bookings are reserved for one partner: they are
 * invisible to and unclaimable by everyone else, even after the partner rejects or the window lapses,
 * until the customer chooses again (BookingsService.redispatch).
 */
export function dispatchState(b: DispatchFields, now = new Date()): DispatchState {
  if (b.assignmentMode === 'any') return 'open';
  if (b.requestOutcome === 'rejected') return 'rejected';
  if (b.requestOutcome === 'expired') return 'expired';
  if (b.requestExpiresAt && b.requestExpiresAt.getTime() <= now.getTime()) return 'expired';
  return 'awaiting_partner';
}

/** Prisma filter: bookings this partner may see and claim right now. */
export function claimableBy(partnerId: string, now = new Date()): Prisma.BookingWhereInput {
  return {
    OR: [
      { assignmentMode: 'any' },
      { assignmentMode: 'specific', requestedPartnerId: partnerId, requestOutcome: null, requestExpiresAt: { gt: now } },
    ],
  };
}

@Injectable()
export class DispatchService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private notifications: NotificationsService
  ) {}

  /** Starts (or restarts) the answer window of a direct request. No-op for open bookings. */
  async openRequestWindow(bookingId: string): Promise<Date | null> {
    const expiresAt = new Date(Date.now() + directRequestTtlMinutes() * 60_000);
    const res = await this.prisma.booking.updateMany({
      where: { id: bookingId, assignmentMode: 'specific', partnerId: null },
      data: { requestExpiresAt: expiresAt, requestOutcome: null },
    });
    return res.count ? expiresAt : null;
  }

  /** Tells only the chosen partner about the job (realtime popup + push + in-app notification). */
  async notifyRequestedPartner(bookingId: string): Promise<void> {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b || b.assignmentMode !== 'specific' || !b.requestedPartnerId) return;
    const partnerId = b.requestedPartnerId;
    const payload = {
      bookingId: b.id,
      type: b.type,
      direct: true,
      petName: b.petName,
      petBreed: b.petBreed,
      petSpecies: b.petSpecies,
      durationMinutes: b.durationMinutes ?? undefined,
      scheduledAt: b.scheduledAt ? b.scheduledAt.toISOString() : null,
      addressLine: b.addressLine,
      pickupAddress: b.addressLine,
      partnerPayout: Math.round(Number(b.total) * (1 - BUSINESS_CONFIG.PLATFORM_COMMISSION_RATE)),
      expiresAt: b.requestExpiresAt ? b.requestExpiresAt.toISOString() : null,
    };
    this.realtime.emitToUser(partnerId, b.type === 'walking' ? 'walk:request_sent' : 'job:available', payload);
    await this.notifications.sendPush(partnerId, {
      title: `Request for ${b.petName} 🐾`,
      body: 'A customer chose you for this booking. Accept before the request expires.',
      data: { type: 'job:direct_request', bookingId: b.id, expiresAt: payload.expiresAt ?? '' },
    });
  }

  /** Tells the customer their chosen partner declined. */
  async notifyRejected(bookingId: string): Promise<void> {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { customerId: true, petName: true } });
    if (!b) return;
    await this.notifications.sendPush(b.customerId, {
      title: 'Partner unavailable',
      body: `Your chosen partner can't take ${b.petName}'s booking. Pick another partner or let anyone accept.`,
      data: { type: 'booking:partner_declined', bookingId },
    });
    this.realtime.emitToBooking(bookingId, 'booking:dispatch_changed', { bookingId, state: 'rejected' });
  }
}
