import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async getDashboardKpis() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todaysBookings,
      unassignedBookings,
      needsPartner,
      storeOrdersPlaced,
      assignedBookings,
      pendingBookings,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { scheduledAt: { gte: today, lt: tomorrow }, status: { notIn: ['cancelled', 'refunded'] } },
      }),
      this.prisma.booking.count({
        where: { partnerId: null, status: { notIn: ['cancelled', 'completed', 'refunded', 'draft'] } },
      }),
      this.prisma.booking.count({ where: { status: 'needs_partner' } }),
      this.prisma.storeOrder.count({
        where: { createdAt: { gte: today, lt: tomorrow }, status: { notIn: ['cancelled'] } },
      }),
      this.prisma.booking.count({ where: { status: 'assigned' } }),
      this.prisma.booking.count({ where: { status: { in: ['confirmed', 'pending_payment'] } } }),
    ]);

    return {
      todaysBookings,
      unassignedBookings,
      needsPartnerBookings: needsPartner,
      storeOrdersPlaced,
      assignedBookings,
      pendingBookings,
    };
  }

  async createBookingForCustomer(staffId: string, data: {
    customerId: string; petId: string; type: string;
    packageId?: string; addOnIds?: string[]; durationMinutes?: number;
    scheduledAt: string; addressId: string; notes?: string;
    partnerId?: string; channel: string;
  }) {
    // Staff creates a booking on behalf of customer (off-app channels)
    const pet = await this.prisma.pet.findFirst({ where: { id: data.petId, customerId: data.customerId } });

    const careNote = await this.prisma.petCareNote.findFirst({
      where: { petId: data.petId },
      orderBy: { createdAt: 'desc' },
    });

    const address = await this.prisma.address.findUniqueOrThrow({ where: { id: data.addressId } });

    let subtotal = 0;
    let packageName = '';
    let packagePrice = 0;

    if (data.type === 'grooming' && data.packageId) {
      const pkg = await this.prisma.groomingPackage.findUniqueOrThrow({ where: { id: data.packageId } });
      subtotal = Number(pkg.price);
      packageName = pkg.name;
      packagePrice = Number(pkg.price);

      if (data.addOnIds?.length) {
        const addOns = await this.prisma.addOn.findMany({ where: { id: { in: data.addOnIds } } });
        subtotal += addOns.reduce((s, a) => s + Number(a.price), 0);
      }
    } else if (data.type === 'walking' && data.durationMinutes) {
      const pricing = await this.prisma.walkPricing.findFirst({
        where: { durationMinutes: data.durationMinutes, isActive: true },
      });
      subtotal = Number(pricing?.price ?? 0);
    }

    return this.prisma.booking.create({
      data: {
        type: data.type,
        status: data.partnerId ? 'assigned' : 'needs_partner',
        customerId: data.customerId,
        petId: data.petId,
        petName: pet?.name ?? '',
        petBreed: pet?.breed ?? '',
        petSize: pet?.size ?? 'medium',
        petCareNotes: careNote?.note ?? null,
        partnerId: data.partnerId ?? null,
        packageId: data.packageId ?? null,
        packageName: packageName || null,
        packagePrice: packagePrice || null,
        durationMinutes: data.durationMinutes ?? null,
        scheduledAt: new Date(data.scheduledAt),
        addressId: data.addressId,
        addressLine: `${address.line1}, ${address.city}`,
        channel: data.channel,
        notes: data.notes ?? null,
        subtotal,
        discount: 0,
        total: subtotal,
        paymentMethod: 'cash_after_service',
        paymentStatus: 'pending',
        statusHistory: {
          create: {
            status: data.partnerId ? 'assigned' : 'needs_partner',
            changedBy: staffId,
            note: `Created by staff via ${data.channel}`,
          },
        },
      },
    });
  }

  async assignPartner(bookingId: string, partnerId: string, staffId: string) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerId,
        status: 'assigned',
        statusHistory: {
          create: { status: 'assigned', changedBy: staffId, note: `Partner assigned by staff` },
        },
      },
    });
  }

  async unassignPartner(bookingId: string, staffId: string) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerId: null,
        status: 'needs_partner',
        statusHistory: {
          create: { status: 'needs_partner', changedBy: staffId, note: 'Partner unassigned by staff' },
        },
      },
    });
  }

  async listCustomers(filters: { search?: string; page?: number; pageSize?: number } = {}) {
    const { search, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where = search ? {
      OR: [
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { profile: { firstName: { contains: search, mode: 'insensitive' as const } } },
      ],
    } : { role: 'customer' as const };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'customer', ...where },
        skip,
        take: pageSize,
        include: { profile: true, _count: { select: { bookings: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { role: 'customer' } }),
    ]);

    return { data: data.map(({ passwordHash, ...u }) => u), total, page, pageSize };
  }
}
