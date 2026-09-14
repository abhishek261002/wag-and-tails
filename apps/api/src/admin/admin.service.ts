import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { startOfMonth, subMonths, endOfMonth, subDays, format } from 'date-fns';
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

  async getReports() {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
    const monthlyRevenue = await Promise.all(
      months.map(async (m) => {
        const from = startOfMonth(m);
        const to = endOfMonth(m);
        const payments = await this.prisma.payment.findMany({
          where: { status: 'paid', createdAt: { gte: from, lte: to } },
          select: { amount: true },
        });
        return {
          month: format(m, 'yyyy-MM'),
          label: format(m, 'MMM'),
          revenue: Math.round(payments.reduce((s, p) => s + Number(p.amount), 0)),
        };
      })
    );

    const rangeStart = startOfMonth(subMonths(new Date(), 5));

    const [groomingRevenue, walkingRevenue, storeOrders, channelGroups, completedBookings, repeatCustomers, distinctCustomers, activePartners, utilizedPartners] =
      await Promise.all([
        this.prisma.booking.aggregate({
          where: { type: 'grooming', status: 'completed', createdAt: { gte: rangeStart } },
          _sum: { total: true },
        }),
        this.prisma.booking.aggregate({
          where: { type: 'walking', status: 'completed', createdAt: { gte: rangeStart } },
          _sum: { total: true },
        }),
        this.prisma.storeOrder.aggregate({
          where: { createdAt: { gte: rangeStart }, status: { not: 'cancelled' } },
          _sum: { total: true },
        }),
        this.prisma.booking.groupBy({
          by: ['channel'],
          where: { createdAt: { gte: rangeStart } },
          _count: { id: true },
        }),
        this.prisma.booking.aggregate({
          where: { status: 'completed', createdAt: { gte: rangeStart } },
          _sum: { total: true },
          _count: { id: true },
        }),
        this.prisma.booking.groupBy({
          by: ['customerId'],
          where: { status: 'completed', createdAt: { gte: rangeStart } },
          _count: { id: true },
          having: { id: { _count: { gt: 1 } } },
        }),
        this.prisma.booking.groupBy({
          by: ['customerId'],
          where: { status: 'completed', createdAt: { gte: rangeStart } },
        }),
        this.prisma.partnerProfile.count({ where: { status: 'approved' } }),
        this.prisma.booking.groupBy({
          by: ['partnerId'],
          where: { status: 'completed', createdAt: { gte: subDays(new Date(), 30) }, partnerId: { not: null } },
        }),
      ]);

    const channelTotal = channelGroups.reduce((s, g) => s + g._count.id, 0) || 1;
    const channelSplit = channelGroups.map((g) => ({
      channel: g.channel,
      count: g._count.id,
      pct: Math.round((g._count.id / channelTotal) * 100),
    }));

    const lineTotals = {
      grooming: Number(groomingRevenue._sum.total ?? 0),
      walking: Number(walkingRevenue._sum.total ?? 0),
      store: Number(storeOrders._sum.total ?? 0),
    };
    const lineSum = lineTotals.grooming + lineTotals.walking + lineTotals.store || 1;

    const grossRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0);
    const avgBookingValue = completedBookings._count.id > 0
      ? Math.round(Number(completedBookings._sum.total ?? 0) / completedBookings._count.id)
      : 0;
    const repeatRate = distinctCustomers.length > 0
      ? Math.round((repeatCustomers.length / distinctCustomers.length) * 100)
      : 0;
    const partnerUtilization = activePartners > 0
      ? Math.round((utilizedPartners.length / activePartners) * 100)
      : 0;

    return {
      monthlyRevenue,
      revenueByLine: [
        { line: 'Grooming', revenue: lineTotals.grooming, share: Math.round((lineTotals.grooming / lineSum) * 100) },
        { line: 'Dog walking', revenue: lineTotals.walking, share: Math.round((lineTotals.walking / lineSum) * 100) },
        { line: 'Store', revenue: lineTotals.store, share: Math.round((lineTotals.store / lineSum) * 100) },
      ],
      channelSplit,
      kpis: { grossRevenue, avgBookingValue, repeatRate, partnerUtilization },
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

  async getServiceAreas() {
    const partners = await this.prisma.partnerProfile.findMany({
      where: { status: 'approved', city: { not: null } },
      select: { city: true, modes: true },
    });

    const byCity = new Map<string, { groomers: number; walkers: number }>();
    for (const p of partners) {
      const city = (p.city ?? '').trim();
      if (!city) continue;
      const entry = byCity.get(city) ?? { groomers: 0, walkers: 0 };
      if (p.modes.includes('grooming')) entry.groomers += 1;
      if (p.modes.includes('walking')) entry.walkers += 1;
      byCity.set(city, entry);
    }

    return Array.from(byCity.entries())
      .map(([city, counts]) => ({
        city,
        groomers: counts.groomers,
        walkers: counts.walkers,
        status: counts.groomers + counts.walkers > 0 ? 'Active' : 'Pending',
      }))
      .sort((a, b) => (b.groomers + b.walkers) - (a.groomers + a.walkers));
  }

  async listStaff() {
    const users = await this.prisma.user.findMany({
      where: { role: { in: ['staff', 'admin'] } },
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ passwordHash, ...u }) => u);
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
