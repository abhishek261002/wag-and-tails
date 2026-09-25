import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { createPaymentProvider, type PaymentProvider } from './payment-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MapsLocationService } from '../maps-location/maps-location.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { isLocationFilteringEnabled } from '../common/feature-flags.js';
import { DispatchService } from '../bookings/dispatch.service.js';

export type { PaymentProvider };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private provider: PaymentProvider;

  constructor(
    private prisma: PrismaService,
    private mapsService: MapsLocationService,
    private realtime: RealtimeGateway,
    private dispatch: DispatchService
  ) {
    this.provider = createPaymentProvider();
  }

  /** Public key the client needs to open the provider's checkout (null for the mock). */
  get publicKey() {
    return this.provider.publicKey;
  }

  // Used by other modules that take money (commission dues) so there is one provider instance.
  createProviderOrder(amountInr: number, referenceId: string) {
    return this.provider.createOrder(amountInr, 'INR', referenceId);
  }

  verifyProviderPayment(paymentId: string, orderId: string, signature: string) {
    return this.provider.verifyPayment(paymentId, orderId, signature);
  }

  // The amount always comes from the server-side booking / order, never from the client.
  async createPaymentOrder(bookingId: string | null, orderId: string | null, userId: string) {
    if (!bookingId === !orderId) throw new BadRequestException('Provide either bookingId or orderId');
    let amount: number;
    if (bookingId) {
      const b = await this.prisma.booking.findUnique({ where: { id: bookingId } });
      if (!b || b.customerId !== userId) throw new NotFoundException('Booking not found');
      if (b.paymentMethod === 'cash_after_service') {
        throw new BadRequestException('This booking is pay-after-service; no online payment is needed');
      }
      if (b.paymentStatus === 'paid' || b.status !== 'pending_payment') {
        throw new ConflictException('This booking is not awaiting payment');
      }
      amount = Number(b.total);
    } else {
      const o = await this.prisma.storeOrder.findUnique({ where: { id: orderId! } });
      if (!o || o.userId !== userId) throw new NotFoundException('Order not found');
      if (o.paymentStatus === 'paid') throw new ConflictException('This order is already paid');
      amount = Number(o.total);
    }
    if (!(amount > 0)) throw new BadRequestException('Nothing to pay');

    const { orderId: providerOrderId } = await this.provider.createOrder(amount, 'INR', bookingId ?? orderId!);
    const key = bookingId ? { bookingId } : { orderId: orderId! };
    const existing = await this.prisma.payment.findFirst({ where: key });
    if (existing && existing.status === 'paid') throw new ConflictException('Already paid');
    // A retry after an abandoned attempt reuses the pending payment row with a fresh provider order.
    const payment = existing
      ? await this.prisma.payment.update({ where: { id: existing.id }, data: { amount, status: 'pending', providerPaymentId: providerOrderId } })
      : await this.prisma.payment.create({
          data: { ...key, userId, amount, currency: 'INR', method: 'pending', status: 'pending', providerPaymentId: providerOrderId },
        });

    return { payment, providerOrderId, keyId: this.provider.publicKey };
  }

  async confirmPayment(user: { sub: string; role: string }, paymentId: string, method: string, providerPaymentId?: string, signature?: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing || (existing.userId !== user.sub && !['staff', 'admin'].includes(user.role))) {
      throw new NotFoundException('Payment not found');
    }
    if (existing.status === 'paid') return existing; // idempotent
    if (!['upi', 'card', 'wallet'].includes(method)) throw new BadRequestException('Invalid payment method');

    // For the provider, providerPaymentId holds the ORDER id until now (set in createPaymentOrder).
    const ok = await this.provider.verifyPayment(providerPaymentId ?? '', existing.providerPaymentId ?? '', signature ?? '');
    if (!ok) throw new BadRequestException('Payment could not be verified');

    // Only one caller flips pending -> paid; a concurrent duplicate confirm is a no-op.
    const flipped = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: { not: 'paid' } },
      data: { status: 'paid', method, providerPaymentId: providerPaymentId ?? existing.providerPaymentId },
    });
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (flipped.count === 0) return payment;

    if (payment.bookingId) {
      const booking = await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: 'paid', status: 'confirmed' },
      });
      // Grooming is ready for a partner to claim the moment it is paid; walking has its own search step.
      if (booking.type === 'grooming') await this.dispatchGroomingBooking(booking.id);
    }
    if (payment.orderId) {
      await this.prisma.storeOrder.update({ where: { id: payment.orderId }, data: { paymentStatus: 'paid' } });
    }
    return payment;
  }

  // Pay-after-service: nothing is charged now. The booking is confirmed and offered to partners; the
  // customer pays the partner directly once the service is done.
  async confirmPayAfterService(userId: string, bookingId: string) {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b || b.customerId !== userId) throw new NotFoundException('Booking not found');
    if (b.paymentMethod !== 'cash_after_service') throw new BadRequestException('This booking is not pay-after-service');
    const flipped = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'pending_payment' },
      data: { status: 'confirmed' },
    });
    if (flipped.count === 0) throw new ConflictException('This booking is already confirmed');
    await this.prisma.bookingStatusHistory.create({
      data: { bookingId, status: 'confirmed', changedBy: userId, note: 'Pay after service' },
    });
    if (b.type === 'grooming') await this.dispatchGroomingBooking(bookingId);
    return this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  }

  private async dispatchGroomingBooking(bookingId: string) {
    const existing = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'needs_partner',
        // changedBy is a UUID column with no "system" actor to attribute
        // this automatic transition to, so it's recorded against the
        // customer whose payment triggered it.
        statusHistory: { create: { status: 'needs_partner', changedBy: existing.customerId, note: 'Payment confirmed' } },
      },
    });
    await this.announceGrooming(bookingId);
  }

  // Tells partners about a grooming booking that needs one. A booking reserved for a chosen partner is
  // announced to that partner only; everything else goes to eligible partners as before.
  async announceGrooming(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { address: true } });
    if (booking.assignmentMode === 'specific') {
      await this.dispatch.openRequestWindow(bookingId);
      await this.dispatch.notifyRequestedPartner(bookingId);
      return;
    }
    if (!booking.address) return;

    const payload = {
      bookingId: booking.id,
      type: 'grooming',
      petName: booking.petName,
      petBreed: booking.petBreed,
      scheduledAt: booking.scheduledAt ? booking.scheduledAt.toISOString() : null,
      addressLine: booking.addressLine,
      partnerPayout: Math.round(Number(booking.total) * 0.8),
    };

    if (!isLocationFilteringEnabled()) {
      // v1/dev bypass: skip nearby-partner matching entirely and
      // broadcast to every connected partner (the `role:partner` socket
      // room, joined by anyone toggled online) so testing works without
      // needing matching lat/lng between test accounts. Set
      // ENABLE_LOCATION_FILTERING=true (or leave it unset) for real
      // geofenced, per-partner targeting in production.
      this.realtime.emitToRole('partner', 'job:available', payload);
      return;
    }

    // City-based dispatch: every partner assigned to the booking's city
    // gets the job, not just the nearest few by distance — see
    // WalkingService.searchNearbyPartners for the walking equivalent.
    const cityPartners = await this.mapsService.findPartnersInCity(booking.address.city);
    const eligible = cityPartners.filter((p) => p.modes.includes('grooming'));

    for (const partner of eligible) {
      this.realtime.emitToUser(partner.id, 'job:available', payload);
    }
  }

  async refund(paymentId: string, amount: number, reason: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== 'paid' && payment.status !== 'refunded') throw new BadRequestException('Only paid payments can be refunded');
    if (!(amount > 0)) throw new BadRequestException('Refund amount must be positive');
    const prior = await this.prisma.refund.aggregate({ where: { paymentId }, _sum: { amount: true } });
    const already = Number(prior._sum.amount ?? 0);
    if (already + amount > Number(payment.amount) + 0.001) {
      throw new BadRequestException(`Cannot refund more than was paid (already refunded ₹${already})`);
    }
    const { refundId } = await this.provider.initiateRefund(payment.providerPaymentId ?? '', amount);

    const refund = await this.prisma.refund.create({
      data: { paymentId, amount, reason, status: 'processing', providerRefundId: refundId },
    });
    // Only a full refund flips the payment; a partial one (e.g. partner discount) leaves it paid.
    if (already + amount >= Number(payment.amount) - 0.001) {
      await this.prisma.payment.update({ where: { id: paymentId }, data: { status: 'refunded' } });
    }
    return refund;
  }

  // A partner's discount lowered what an already-paid online booking costs: return the difference.
  async refundDiscountDifference(bookingId: string, newTotal: number) {
    const payment = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (!payment || payment.status !== 'paid') return null;
    const prior = await this.prisma.refund.aggregate({ where: { paymentId: payment.id }, _sum: { amount: true } });
    const kept = Number(payment.amount) - Number(prior._sum.amount ?? 0);
    const delta = Math.round((kept - newTotal) * 100) / 100;
    if (delta <= 0) return null;
    try {
      return await this.refund(payment.id, delta, 'Partner discount applied');
    } catch (err) {
      this.logger.error(`Discount refund failed for booking ${bookingId}: ${(err as Error).message}`);
      return null;
    }
  }
}
