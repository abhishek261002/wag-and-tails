import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { addHours, isAfter } from 'date-fns';

// Packages store their services as ordered rows (`items`); the apps and the admin panel read a plain
// `inclusions: string[]`. Every package response goes through this so the two never drift apart again.
const ITEMS = { items: { orderBy: { order: 'asc' as const } } };
function present<T extends { items?: { description: string }[] }>(pkg: T) {
  return { ...pkg, inclusions: (pkg.items ?? []).map((i) => i.description) };
}

@Injectable()
export class GroomingService {
  constructor(private prisma: PrismaService) {}

  async getPackages() {
    const rows = await this.prisma.groomingPackage.findMany({
      where: { isActive: true },
      include: ITEMS,
      orderBy: { price: 'asc' },
    });
    return rows.map(present);
  }

  async getPackage(packageId: string) {
    const pkg = await this.prisma.groomingPackage.findUnique({
      where: { id: packageId },
      include: ITEMS,
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return present(pkg);
  }

  async getAddOns() {
    return this.prisma.addOn.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async getAvailableSlots(packageId: string, date: string, addressId: string): Promise<string[]> {
    // Generate time slots for the given date (09:00–18:00, 1h intervals)
    const slots: string[] = [];
    const targetDate = new Date(date);

    for (let h = 9; h <= 17; h++) {
      const slotTime = new Date(targetDate);
      slotTime.setHours(h, 0, 0, 0);

      // Skip past slots
      if (!isAfter(slotTime, addHours(new Date(), 1))) continue;

      // Check capacity (max 8 active bookings per hour window)
      const endTime = addHours(slotTime, 1);
      const count = await this.prisma.booking.count({
        where: {
          type: 'grooming',
          scheduledAt: { gte: slotTime, lt: endTime },
          status: { notIn: ['cancelled', 'refunded'] },
        },
      });

      if (count < 8) {
        slots.push(slotTime.toISOString());
      }
    }

    return slots;
  }

  // Admin CRUD
  async createPackage(data: {
    name: string; mrp: number; price: number; description?: string;
    inclusions: string[];
  }) {
    const { inclusions, ...pkg } = data;
    return present(await this.prisma.groomingPackage.create({
      data: {
        ...pkg,
        items: { create: inclusions.map((desc, i) => ({ description: desc, order: i })) },
      },
      include: ITEMS,
    }));
  }

  // Only these fields are editable; anything else in the body (id, createdAt, items...) is ignored rather than
  // passed to the database. `inclusions`, when given, replaces the package's service list atomically.
  async updatePackage(packageId: string, data: Partial<{
    name: string; mrp: number; price: number; description: string; isActive: boolean; inclusions: string[];
  }>) {
    const exists = await this.prisma.groomingPackage.findUnique({ where: { id: packageId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Package not found');
    const { name, mrp, price, description, isActive, inclusions } = data ?? {};
    const list = Array.isArray(inclusions)
      ? inclusions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
      : null;
    if (list && list.length === 0) throw new BadRequestException('A package needs at least one service');
    return present(await this.prisma.groomingPackage.update({
      where: { id: packageId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(mrp !== undefined ? { mrp } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(list ? { items: { deleteMany: {}, create: list.map((d, i) => ({ description: d, order: i })) } } : {}),
      },
      include: ITEMS,
    }));
  }

  async createAddOn(data: { name: string; price: number; description?: string }) {
    return this.prisma.addOn.create({ data });
  }

  async updateAddOn(addOnId: string, data: Partial<{ name: string; price: number; isActive: boolean }>) {
    return this.prisma.addOn.update({ where: { id: addOnId }, data });
  }
}
