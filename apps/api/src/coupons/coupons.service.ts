import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DiscountType } from '@prisma/client';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async apply(code: string, service: string, orderValue: number, userId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) throw new NotFoundException('Invalid or inactive coupon');

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new BadRequestException('Coupon expired or not yet valid');
    }

    if (
      coupon.applicableServices.length > 0 &&
      !coupon.applicableServices.includes('all') &&
      !coupon.applicableServices.includes(service)
    ) {
      throw new BadRequestException(`Coupon not applicable to ${service}`);
    }

    if (coupon.minOrderValue && orderValue < Number(coupon.minOrderValue)) {
      throw new BadRequestException(
        `Minimum order value ₹${coupon.minOrderValue} required`
      );
    }

    // Check usage limits
    if (coupon.usageLimitTotal && coupon.timesUsed >= coupon.usageLimitTotal) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (coupon.usageLimitPerUser) {
      const userUsage = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });
      if (userUsage >= coupon.usageLimitPerUser) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'flat') {
      discount = Math.min(Number(coupon.discountValue), orderValue);
    } else {
      discount = (orderValue * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, Number(coupon.maxDiscount));
      }
    }

    discount = Math.round(discount);
    return { discount, newTotal: orderValue - discount, coupon };
  }

  /**
   * Every coupon a customer could see at checkout for this service and order value, each with what it would save
   * now or why it can't be used (minimum order not met, already used). Uses exactly the rules apply() enforces, so
   * a coupon shown as usable is accepted when the booking is placed. Coupons that nobody can use any more (expired,
   * inactive, used up overall) are left out.
   */
  async listAvailable(service: unknown, orderValue: unknown, userId: string) {
    const svc = typeof service === 'string' ? service : '';
    if (!['grooming', 'walking', 'store'].includes(svc)) throw new BadRequestException('service must be grooming, walking or store');
    const value = Number(orderValue);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) throw new BadRequestException('orderValue is not valid');

    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      orderBy: { createdAt: 'desc' },
    });
    const usable = coupons.filter((c) =>
      (c.applicableServices.length === 0 || c.applicableServices.includes('all') || c.applicableServices.includes(svc)) &&
      !(c.usageLimitTotal && c.timesUsed >= c.usageLimitTotal));
    const used = usable.length
      ? await this.prisma.couponRedemption.groupBy({ by: ['couponId'], where: { userId, couponId: { in: usable.map((c) => c.id) } }, _count: { _all: true } })
      : [];
    const usedBy = new Map(used.map((u) => [u.couponId, u._count._all]));

    const rows = usable.map((c) => {
      const min = c.minOrderValue ? Number(c.minOrderValue) : 0;
      const alreadyUsed = !!c.usageLimitPerUser && (usedBy.get(c.id) ?? 0) >= c.usageLimitPerUser;
      let discount = c.discountType === 'flat' ? Math.min(Number(c.discountValue), value) : (value * Number(c.discountValue)) / 100;
      if (c.discountType !== 'flat' && c.maxDiscount) discount = Math.min(discount, Number(c.maxDiscount));
      discount = Math.round(discount);
      const reason = alreadyUsed ? 'You have already used this coupon' : value < min ? `Add ₹${Math.ceil(min - value)} more to use this coupon` : null;
      return {
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
        minOrderValue: min || null,
        validUntil: c.validUntil.toISOString(),
        eligible: !reason,
        reason,
        discount: reason ? 0 : discount,
      };
    });
    // Usable ones first, biggest saving first; then the rest.
    return rows.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.discount - a.discount);
  }

  async recordRedemption(couponId: string, userId: string, bookingId?: string, orderId?: string) {
    await this.prisma.couponRedemption.create({
      data: { couponId, userId, bookingId: bookingId ?? null, orderId: orderId ?? null },
    });
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { timesUsed: { increment: 1 } },
    });
  }

  async list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async listActive() {
    const now = new Date();
    return this.prisma.coupon.findMany({
      where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    code: string; description: string; discountType: string; discountValue: number;
    maxDiscount?: number; minOrderValue?: number; applicableServices: string[];
    usageLimitTotal?: number; usageLimitPerUser?: number;
    validFrom: string; validUntil: string;
  }) {
    return this.prisma.coupon.create({
      data: {
        ...data,
        discountType: data.discountType as DiscountType,
        discountValue: data.discountValue,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
      },
    });
  }

  async update(couponId: string, data: Partial<{ isActive: boolean; validUntil: string }>) {
    const { validUntil, ...rest } = data;
    return this.prisma.coupon.update({
      where: { id: couponId },
      data: { ...rest, ...(validUntil ? { validUntil: new Date(validUntil) } : {}) },
    });
  }

  async delete(couponId: string) {
    return this.prisma.coupon.delete({ where: { id: couponId } });
  }
}
