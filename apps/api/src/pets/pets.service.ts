import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { PetSex, PetSize, CoatType } from '@prisma/client';

@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}

  async listByCustomer(customerId: string) {
    return this.prisma.pet.findMany({
      where: { customerId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        careNotes: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { bookings: true } },
      },
    });
  }

  async getDetail(petId: string, requesterId: string, requesterRole: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: {
        careNotes: { orderBy: { createdAt: 'desc' } },
        vaccinations: { orderBy: { administeredDate: 'desc' } },
      },
    });

    if (!pet) throw new NotFoundException('Pet not found');

    // Customers can only view their own pets; staff/admin/partner can view all
    if (requesterRole === 'customer' && pet.customerId !== requesterId) {
      throw new ForbiddenException('Access denied');
    }

    return pet;
  }

  async create(customerId: string, data: {
    name: string; breed: string; sex: string; dateOfBirth?: string;
    weightKg?: number; size: string; coatType: string; isNeutered?: boolean;
    temperament?: string; allergies?: string; careNote?: string;
    vetDoctorName?: string; vetClinic?: string; vetPhone?: string;
  }) {
    const count = await this.prisma.pet.count({ where: { customerId, isActive: true } });
    if (count >= BUSINESS_CONFIG.MAX_PETS_PER_CUSTOMER) {
      throw new BadRequestException(`Maximum ${BUSINESS_CONFIG.MAX_PETS_PER_CUSTOMER} pets allowed`);
    }

    const { careNote, sex, size, coatType, ...petData } = data;

    return this.prisma.pet.create({
      data: {
        ...petData,
        sex: sex as PetSex,
        size: size as PetSize,
        coatType: coatType as CoatType,
        customerId,
        dateOfBirth: petData.dateOfBirth ? new Date(petData.dateOfBirth) : null,
        careNotes: careNote
          ? { create: { note: careNote, addedBy: customerId, addedByRole: 'customer' } }
          : undefined,
      },
      include: {
        careNotes: true,
        vaccinations: true,
      },
    });
  }

  async update(petId: string, customerId: string, data: Partial<{
    name: string; breed: string; sex: string; dateOfBirth: string;
    weightKg: number; size: string; coatType: string; isNeutered: boolean;
    temperament: string; allergies: string;
    vetDoctorName: string; vetClinic: string; vetPhone: string;
  }>) {
    await this.assertOwnership(petId, customerId);
    const { dateOfBirth, sex, size, coatType, ...rest } = data;
    return this.prisma.pet.update({
      where: { id: petId },
      data: {
        ...rest,
        ...(sex !== undefined ? { sex: sex as PetSex } : {}),
        ...(size !== undefined ? { size: size as PetSize } : {}),
        ...(coatType !== undefined ? { coatType: coatType as CoatType } : {}),
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      },
    });
  }

  async delete(petId: string, customerId: string) {
    await this.assertOwnership(petId, customerId);
    await this.prisma.pet.update({ where: { id: petId }, data: { isActive: false } });
  }

  async addCareNote(petId: string, note: string, addedBy: string, addedByRole: string) {
    // Verify pet exists (accessible check depends on requester role — done at controller)
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) throw new NotFoundException('Pet not found');

    return this.prisma.petCareNote.create({
      data: { petId, note, addedBy, addedByRole },
    });
  }

  async addVaccination(petId: string, customerId: string, data: {
    vaccineName: string; administeredDate: string;
    expiryDate?: string; vetName?: string; certificateUrl?: string;
  }) {
    await this.assertOwnership(petId, customerId);
    return this.prisma.petVaccination.create({
      data: {
        petId,
        vaccineName: data.vaccineName,
        administeredDate: new Date(data.administeredDate),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        vetName: data.vetName ?? null,
        certificateUrl: data.certificateUrl ?? null,
      },
    });
  }

  async updateAvatar(petId: string, customerId: string, avatarUrl: string) {
    await this.assertOwnership(petId, customerId);
    return this.prisma.pet.update({ where: { id: petId }, data: { avatarUrl } });
  }

  private async assertOwnership(petId: string, customerId: string) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) throw new NotFoundException('Pet not found');
    if (pet.customerId !== customerId) throw new ForbiddenException('Access denied');
    return pet;
  }
}
