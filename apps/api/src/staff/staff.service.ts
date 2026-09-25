import { Injectable, NotFoundException, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { CommissionService } from '../commission/commission.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingType, BookingChannel, BookingStatus, PaymentMethod } from '@prisma/client';
import { speciesSupportsService } from '../common/species.js';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService, private commission: CommissionService) {}

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
    if (!pet) throw new NotFoundException('Pet not found for this customer');
    if (data.type === 'walking' && !speciesSupportsService(pet.species, 'walking')) {
      throw new UnprocessableEntityException({
        code: 'SPECIES_NOT_SUPPORTED',
        message: 'Walks are only available for dogs. This pet can be booked for grooming.',
      });
    }

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
      if (!pkg.applicableSpecies.includes(pet.species)) {
        throw new UnprocessableEntityException({
          code: 'SPECIES_NOT_SUPPORTED',
          message: `This package is not available for ${pet.species}s`,
        });
      }
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
        type: data.type as BookingType,
        status: (data.partnerId ? 'assigned' : 'needs_partner') as BookingStatus,
        customerId: data.customerId,
        petId: data.petId,
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed,
        petSize: pet.size,
        petCareNotes: careNote?.note ?? null,
        partnerId: data.partnerId ?? null,
        packageId: data.packageId ?? null,
        packageName: packageName || null,
        packagePrice: packagePrice || null,
        durationMinutes: data.durationMinutes ?? null,
        scheduledAt: new Date(data.scheduledAt),
        addressId: data.addressId,
        addressLine: `${address.line1}, ${address.city}`,
        channel: data.channel as BookingChannel,
        notes: data.notes ?? null,
        subtotal,
        discount: 0,
        total: subtotal,
        paymentMethod: 'cash_after_service' as PaymentMethod,
        paymentStatus: 'pending' as const,
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
    const [booking, partner] = await Promise.all([
      this.prisma.booking.findUnique({ where: { id: bookingId } }),
      this.prisma.partnerProfile.findUnique({ where: { userId: partnerId } }),
    ]);
    if (!booking) throw new NotFoundException('Booking not found');
    if (!partner || partner.status !== 'approved') throw new UnprocessableEntityException('Choose an approved partner');
    if (!partner.modes.includes(booking.type)) throw new UnprocessableEntityException(`This partner does not offer ${booking.type}`);
    if (!(partner.petSpecies as string[]).includes(booking.petSpecies)) throw new UnprocessableEntityException(`This partner does not take ${booking.petSpecies}s`);
    // Same conditional-update guard as a partner claiming, so staff and a partner cannot both win.
    const claimed = await this.prisma.booking.updateMany({
      where: { id: bookingId, partnerId: null, status: { in: ['needs_partner', 'confirmed', 'searching_partner'] } },
      data: {
        partnerId,
        status: (booking.type === 'walking' ? 'accepted' : 'assigned') as BookingStatus,
        // Without a start code the partner could never begin the session.
        startOtp: String(Math.floor(1000 + Math.random() * 9000)),
        assignmentMode: 'any',
        requestedPartnerId: null,
        requestOutcome: null,
      },
    });
    if (claimed.count === 0) throw new BadRequestException('This booking already has a partner or cannot be assigned right now');
    const status = booking.type === 'walking' ? 'accepted' : 'assigned';
    await this.prisma.bookingStatusHistory.create({ data: { bookingId, status: status as BookingStatus, changedBy: staffId, note: 'Partner assigned by staff' } });
    await this.commission.applyClaimPricing(bookingId, partnerId);
    return this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  }

  async unassignPartner(bookingId: string, staffId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['assigned', 'accepted', 'partner_on_the_way'].includes(booking.status)) {
      throw new BadRequestException('A partner can only be removed before the session starts');
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerId: null,
        startOtp: null,
        status: (booking.type === 'walking' ? 'searching_partner' : 'needs_partner') as BookingStatus,
        // The next partner prices the job afresh; until then an unpaid booking shows the undiscounted price.
        partnerDiscountPct: null,
        partnerDiscountAmount: 0,
        discountSource: booking.discount.gt(0) ? 'coupon' : null,
        commissionPct: null,
        commissionAmount: null,
        partnerShareAmount: null,
        ...(booking.paymentStatus === 'paid' ? {} : { total: booking.subtotal.minus(booking.discount) }),
        statusHistory: {
          create: { status: booking.type === 'walking' ? 'searching_partner' : 'needs_partner', changedBy: staffId, note: 'Partner unassigned by staff' },
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
        include: { profile: true, customerProfile: true, _count: { select: { bookings: true, pets: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { role: 'customer' } }),
    ]);

    return { data: data.map(({ passwordHash, ...u }) => u), total, page, pageSize };
  }

  async getCustomer(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, pets: true, addresses: true, _count: { select: { bookings: true } } },
    });
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
