import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BUSINESS_CONFIG } from '@wag/config';

@Injectable()
export class PayoutsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a payout record when a job is completed.
   * Called automatically after booking completes.
   */
  async createFromBooking(bookingId: string, partnerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const grossAmount = Number(booking.total);
    const commissionAmount = Math.round(grossAmount * BUSINESS_CONFIG.PLATFORM_COMMISSION_RATE);
    const netAmount = grossAmount - commissionAmount;

    return this.prisma.payout.create({
      data: {
        partnerId,
        bookingId,
        grossAmount,
        commissionRate: BUSINESS_CONFIG.PLATFORM_COMMISSION_RATE,
        commissionAmount,
        netAmount,
        status: 'pending',
      },
    });
  }

  async requestPayout(partnerId: string, amount: number) {
    return this.prisma.payout.updateMany({
      where: { partnerId, status: 'pending' },
      data: { status: 'requested', requestedAt: new Date() },
    });
  }

  async listByPartner(partnerId: string) {
    return this.prisma.payout.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll(filters: { status?: string; page?: number; pageSize?: number } = {}) {
    const { status, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip,
        take: pageSize,
        include: { partner: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async approveBatch(payoutIds: string[], adminId: string) {
    const batch = await this.prisma.payoutBatch.create({
      data: {
        createdBy: adminId,
        totalAmount: 0,
        payoutCount: payoutIds.length,
        status: 'approved',
      },
    });

    let total = 0;
    for (const id of payoutIds) {
      const payout = await this.prisma.payout.update({
        where: { id },
        data: { status: 'approved', batchId: batch.id },
      });
      total += Number(payout.netAmount);
    }

    await this.prisma.payoutBatch.update({
      where: { id: batch.id },
      data: { totalAmount: total },
    });

    return batch;
  }

  async markPaid(batchId: string) {
    await this.prisma.payout.updateMany({
      where: { batchId },
      data: { status: 'paid', paidAt: new Date() },
    });
    return this.prisma.payoutBatch.update({
      where: { id: batchId },
      data: { status: 'paid', processedAt: new Date() },
    });
  }
}
