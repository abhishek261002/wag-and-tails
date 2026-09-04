import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { startOfMonth } from 'date-fns';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardKpis() {
    const monthStart = startOfMonth(new Date());

    const [
      bookings,
      completedBookings,
      cancelledBookings,
      storeOrders,
      payments,
      topPackages,
      bestSellers,
      recentBookings,
      channelGroups,
    ] = await Promise.all([
      this.prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.booking.count({ where: { status: 'completed', createdAt: { gte: monthStart } } }),
      this.prisma.booking.count({ where: { status: 'cancelled', createdAt: { gte: monthStart } } }),
      this.prisma.storeOrder.findMany({
        where: { createdAt: { gte: monthStart }, status: { not: 'cancelled' } },
        select: { total: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'paid', createdAt: { gte: monthStart } },
        select: { amount: true },
      }),
      this.prisma.booking.groupBy({
        by: ['packageName'],
        where: { type: 'grooming', status: 'completed', createdAt: { gte: monthStart } },
        _count: { id: true },
        _sum: { total: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.storeOrderItem.groupBy({
        by: ['productName'],
        where: { order: { createdAt: { gte: monthStart } } },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { customer: { include: { profile: true } }, pet: true },
      }),
      this.prisma.booking.groupBy({
        by: ['channel'],
        where: { createdAt: { gte: monthStart } },
        _count: { id: true },
      }),
    ]);

    // Build channelSplit map
    const channelSplit: Record<string, number> = {};
    for (const group of channelGroups) {
      channelSplit[group.channel] = group._count.id;
    }

    const revenueThisMonth = payments.reduce((s, p) => s + Number(p.amount), 0);
    const storeGmv = storeOrders.reduce((s, o) => s + Number(o.total), 0);
    const cancellationRate = bookings > 0 ? (cancelledBookings / bookings) * 100 : 0;
    const avgBookingValue = completedBookings > 0 ? revenueThisMonth / completedBookings : 0;

    const needsPartner = await this.prisma.booking.count({ where: { status: 'needs_partner' } });

    return {
      revenueThisMonth: Math.round(revenueThisMonth),
      totalBookings: bookings,
      storeGmv: Math.round(storeGmv),
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      avgBookingValue: Math.round(avgBookingValue),
      channelSplit,
      attentionQueue: [
        { type: 'needs_partner', label: 'Bookings needing partner', count: needsPartner, action: '/staff/bookings?status=needs_partner' },
      ],
      topPackages: topPackages.map((p) => ({
        packageName: p.packageName,
        bookings: p._count.id,
        revenue: Number(p._sum.total ?? 0),
      })),
      bestSellers: bestSellers.map((p) => ({
        productName: p.productName,
        sold: p._sum.quantity ?? 0,
        revenue: Number(p._sum.totalPrice ?? 0),
      })),
      recentBookings: recentBookings.map((b) => ({
        ...b,
        total: Number(b.total),
        subtotal: Number(b.subtotal),
        discount: Number(b.discount),
      })),
    };
  }

  async manageProduct(data: {
    categoryId: string; name: string; slug?: string; description?: string;
    mrp: number; retailPrice: number; tradePrice: number;
    tags?: string[]; allergyWarnings?: string[];
  }) {
    const slug = data.slug ?? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    return this.prisma.product.create({ data: { ...data, slug, isActive: true } });
  }

  async updateProduct(productId: string, data: Partial<{
    name: string; mrp: number; retailPrice: number; tradePrice: number; isActive: boolean;
  }>) {
    return this.prisma.product.update({ where: { id: productId }, data });
  }

  async updateWalkPricing(pricingId: string, price: number) {
    return this.prisma.walkPricing.update({ where: { id: pricingId }, data: { price } });
  }

  async manageStaffUser(action: 'create' | 'suspend', data: { email: string; role?: string }) {
    if (action === 'create') {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('ChangeMe123!', 12);
      return this.prisma.user.create({
        data: {
          email: data.email,
          phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
          role: (data.role ?? 'staff') as UserRole,
          isActive: true,
          passwordHash: hash,
          profile: { create: { firstName: 'Staff', lastName: 'Member' } },
        },
      });
    }
  }

  async getAuditLogs(filters: { page?: number; pageSize?: number } = {}) {
    const { page = 1, pageSize = 50 } = filters;
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip, take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { data, total, page, pageSize };
  }
}
