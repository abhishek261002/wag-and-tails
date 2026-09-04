import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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

  constructor(private prisma: PrismaService) {
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
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: 'paid', status: 'confirmed' },
      });
    }
    if (payment.orderId) {
      await this.prisma.storeOrder.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'paid' },
      });
    }

    return payment;
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
