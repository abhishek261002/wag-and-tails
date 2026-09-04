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
