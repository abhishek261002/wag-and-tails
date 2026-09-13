import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MapsLocationService } from '../maps-location/maps-location.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { isLocationFilteringEnabled } from '../common/feature-flags.js';

// Payment provider abstraction
export interface PaymentProvider {
  createOrder(amount: number, currency: string, referenceId: string): Promise<{ orderId: string }>;
  verifyPayment(paymentId: string, orderId: string, signature: string): Promise<boolean>;
  initiateRefund(paymentId: string, amount: number): Promise<{ refundId: string }>;
}

// Mock provider for local development
class MockPaymentProvider implements PaymentProvider {
  async createOrder(amount: number, _currency: string, referenceId: string) {
    return { orderId: `mock_order_${referenceId}_${Date.now()}` };
  }
  async verifyPayment(_paymentId: string, _orderId: string, _signature: string) {
    return true; // Always succeed in mock
  }
  async initiateRefund(_paymentId: string, _amount: number) {
    return { refundId: `mock_refund_${Date.now()}` };
  }
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private provider: PaymentProvider;

  constructor(
    private prisma: PrismaService,
    private mapsService: MapsLocationService,
    private realtime: RealtimeGateway
  ) {
    const providerName = process.env['PAYMENT_PROVIDER'] ?? 'mock';
    if (providerName === 'mock') {
      this.provider = new MockPaymentProvider();
    } else {
      // TODO: inject RazorpayProvider
      this.provider = new MockPaymentProvider();
    }
  }

  async createPaymentOrder(bookingId: string | null, orderId: string | null, userId: string, amount: number) {
    const referenceId = bookingId ?? orderId ?? userId;
    const { orderId: providerOrderId } = await this.provider.createOrder(amount, 'INR', referenceId);

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: bookingId ?? null,
        orderId: orderId ?? null,
        userId,
        amount,
        currency: 'INR',
        method: 'pending',
        status: 'pending',
        providerPaymentId: providerOrderId,
      },
    });

    return { payment, providerOrderId };
  }

  async confirmPayment(paymentId: string, method: string, providerPaymentId?: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'paid', method, providerPaymentId: providerPaymentId ?? null },
    });

    // Update related booking/order payment status
    if (payment.bookingId) {
      const booking = await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: 'paid', status: 'confirmed' },
      });

      // Grooming bookings have no separate "search partners" step the way
      // walking does — once paid, they're immediately ready for a partner
      // to claim. Move straight to needs_partner and notify eligible
      // online partners in real time, same as the walking dispatch does.
      if (booking.type === 'grooming') {
        await this.dispatchGroomingBooking(booking.id);
      }
    }
    if (payment.orderId) {
      await this.prisma.storeOrder.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'paid' },
      });
    }

    return payment;
  }

  private async dispatchGroomingBooking(bookingId: string) {
    const existing = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'needs_partner',
        // changedBy is a UUID column with no "system" actor to attribute
        // this automatic transition to, so it's recorded against the
        // customer whose payment triggered it.
        statusHistory: { create: { status: 'needs_partner', changedBy: existing.customerId, note: 'Payment confirmed' } },
      },
      include: { address: true },
    });

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
    const { refundId } = await this.provider.initiateRefund(payment.providerPaymentId ?? '', amount);

    const refund = await this.prisma.refund.create({
      data: {
        paymentId,
        amount,
        reason,
        status: 'processing',
        providerRefundId: refundId,
      },
    });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded' },
    });

    return refund;
  }
}
