import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { addHours, isAfter } from 'date-fns';

@Injectable()
export class GroomingService {
  constructor(private prisma: PrismaService) {}

  async getPackages() {
    return this.prisma.groomingPackage.findMany({
      where: { isActive: true },
      include: { items: true },
      orderBy: { price: 'asc' },
    });
  }

  async getPackage(packageId: string) {
    const pkg = await this.prisma.groomingPackage.findUnique({
      where: { id: packageId },
      include: { items: true },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
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
    return this.prisma.groomingPackage.create({
      data: {
        ...pkg,
        items: { create: inclusions.map((desc, i) => ({ description: desc, order: i })) },
      },
      include: { items: true },
    });
  }

  async updatePackage(packageId: string, data: Partial<{
    name: string; mrp: number; price: number; description: string; isActive: boolean;
  }>) {
    return this.prisma.groomingPackage.update({ where: { id: packageId }, data });
  }

  async createAddOn(data: { name: string; price: number; description?: string }) {
    return this.prisma.addOn.create({ data });
  }

  async updateAddOn(addOnId: string, data: Partial<{ name: string; price: number; isActive: boolean }>) {
    return this.prisma.addOn.update({ where: { id: addOnId }, data });
  }
}
