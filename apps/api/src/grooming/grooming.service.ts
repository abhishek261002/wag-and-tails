import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { addHours, isAfter } from 'date-fns';

// Packages store their services as ordered rows (`items`); the apps and the admin panel read a plain
// `inclusions: string[]`. Every package response goes through this so the two never drift apart again.
const ITEMS = { items: { orderBy: { order: 'asc' as const } } };
function present<T extends { items?: { description: string }[] }>(pkg: T) {
  return { ...pkg, inclusions: (pkg.items ?? []).map((i) => i.description) };
}

export const PACKAGE_TAGS = ['previously_booked', 'best_selling', 'best_value'] as const;
export type PackageTag = (typeof PACKAGE_TAGS)[number];

// Bookings that count as "someone really booked this": not abandoned, cancelled, refunded or expired.
const REAL_BOOKING = { notIn: ['draft', 'pending_payment', 'cancelled', 'refunded', 'expired'] as ('draft' | 'pending_payment' | 'cancelled' | 'refunded' | 'expired')[] };

@Injectable()
export class GroomingService {
  constructor(private prisma: PrismaService) {}

  /**
   * The active packages, cheapest first (so the list reads as a ladder), each with `tags`:
   *  - best_selling: the package booked most often across all customers (needs at least one booking);
   *  - best_value: the lowest price per included service (needs two or more packages to compare);
   *  - previously_booked: this customer has booked it before (for this pet, when `petId` is given).
   * A package can carry several tags; the app shows the most useful two.
   */
  async getPackages(customerId?: string, petId?: string) {
    const rows = await this.prisma.groomingPackage.findMany({
      where: { isActive: true },
      include: ITEMS,
      orderBy: [{ price: 'asc' }, { name: 'asc' }],
    });
    const packages = rows.map(present);
    const ids = packages.map((p) => p.id);
    const tags = new Map<string, PackageTag[]>(ids.map((id) => [id, []]));

    if (ids.length > 0) {
      const sold = await this.prisma.booking.groupBy({
        by: ['packageId'],
        where: { type: 'grooming', packageId: { in: ids }, status: REAL_BOOKING },
        _count: { _all: true },
      });
      const top = sold.filter((s) => s.packageId).sort((a, b) => b._count._all - a._count._all)[0];
      // A tie is not a winner: two packages with the same count would both claim the tag.
      const tied = top && sold.filter((s) => s._count._all === top._count._all).length > 1 && packages.length > 1;
      if (top?.packageId && !tied) tags.get(top.packageId)!.push('best_selling');

      if (packages.length >= 2) {
        const perService = (p: (typeof packages)[number]) => Number(p.price) / Math.max(1, p.inclusions.length);
        const cheapest = [...packages].sort((a, b) => perService(a) - perService(b))[0]!;
        const same = packages.filter((p) => Math.abs(perService(p) - perService(cheapest)) < 0.005).length;
        if (same === 1) tags.get(cheapest.id)!.push('best_value');
      }

      if (customerId) {
        const mine = await this.prisma.booking.findMany({
          where: { customerId, type: 'grooming', packageId: { in: ids }, status: REAL_BOOKING, ...(petId ? { petId } : {}) },
          select: { packageId: true },
          distinct: ['packageId'],
        });
        for (const m of mine) if (m.packageId) tags.get(m.packageId)?.unshift('previously_booked');
      }
    }
    return packages.map((p) => ({ ...p, tags: tags.get(p.id) ?? [] }));
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
