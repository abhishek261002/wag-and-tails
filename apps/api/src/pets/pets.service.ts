import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BUSINESS_CONFIG } from '@wag/config';
import { PetSex, PetSize, CoatType, PetSpecies } from '@prisma/client';
import { sizeFromWeight, VACCINATION_VALIDITY_DAYS } from '../common/species.js';
import {
  createPetSchema,
  updatePetSchema,
  parseOrThrow,
  assertPetRules,
  resolveVaccination,
  addDays,
} from './pet.schemas.js';

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

  async create(customerId: string, body: unknown) {
    const dto = parseOrThrow(createPetSchema, body);
    assertPetRules(dto.species, dto);
    const vaccination = resolveVaccination(dto.species, dto.dateOfBirth, dto);

    const count = await this.prisma.pet.count({ where: { customerId, isActive: true } });
    if (count >= BUSINESS_CONFIG.MAX_PETS_PER_CUSTOMER) {
      throw new BadRequestException(`Maximum ${BUSINESS_CONFIG.MAX_PETS_PER_CUSTOMER} pets allowed`);
    }

    return this.prisma.pet.create({
      data: {
        customerId,
        species: dto.species as PetSpecies,
        name: dto.name,
        breed: dto.breed,
        sex: dto.sex as PetSex,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        weightKg: dto.weightKg ?? null,
        size: (dto.weightKg ? sizeFromWeight(dto.species, dto.weightKg) : dto.size ?? 'medium') as PetSize,
        coatType: dto.coatType as CoatType,
        isNeutered: dto.isNeutered ?? false,
        temperament: dto.temperament || null,
        allergies: dto.allergies || null,
        vetDoctorName: dto.vetDoctorName || null,
        vetClinic: dto.vetClinic || null,
        vetPhone: dto.vetPhone || null,
        vaccinationStatus: vaccination ? 'recorded' : 'not_vaccinated_yet',
        careNotes: dto.careNote
          ? { create: { note: dto.careNote, addedBy: customerId, addedByRole: 'customer' } }
          : undefined,
        vaccinations: vaccination
          ? {
              create: {
                vaccineName: vaccination.vaccineName,
                administeredDate: new Date(vaccination.administeredDate),
                expiryDate: new Date(vaccination.expiryDate),
              },
            }
          : undefined,
      },
      include: { careNotes: true, vaccinations: true },
    });
  }

  async update(petId: string, customerId: string, body: unknown) {
    const pet = await this.assertOwnership(petId, customerId);
    const dto = parseOrThrow(updatePetSchema, body);
    // Legacy breeds outside today's list must not block unrelated edits: only re-validate a changed breed.
    assertPetRules(pet.species, { ...dto, breed: dto.breed === pet.breed ? undefined : dto.breed });

    const dobIso = dto.dateOfBirth ?? (pet.dateOfBirth ? pet.dateOfBirth.toISOString().slice(0, 10) : null);
    const wantsVaccination = dto.lastVaccinationDate !== undefined || dto.notVaccinatedYet !== undefined;
    let vaccination: ReturnType<typeof resolveVaccination> | undefined;
    if (wantsVaccination) {
      vaccination = resolveVaccination(pet.species, dobIso, dto);
      if (!vaccination) {
        const existing = await this.prisma.petVaccination.count({ where: { petId } });
        if (existing > 0) throw new BadRequestException('This pet already has vaccinations on record');
      }
    }

    const { careNote: _careNote, lastVaccinationDate: _d, lastVaccineName: _n, notVaccinatedYet: _v, dateOfBirth, sex, size, coatType, weightKg, ...rest } = dto;

    return this.prisma.pet.update({
      where: { id: petId },
      data: {
        ...rest,
        ...(sex !== undefined ? { sex: sex as PetSex } : {}),
        ...(coatType !== undefined ? { coatType: coatType as CoatType } : {}),
        ...(weightKg !== undefined
          ? { weightKg, size: sizeFromWeight(pet.species, weightKg) as PetSize }
          : size !== undefined
            ? { size: size as PetSize }
            : {}),
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        ...(wantsVaccination
          ? {
              vaccinationStatus: vaccination ? ('recorded' as const) : ('not_vaccinated_yet' as const),
              ...(vaccination
                ? {
                    vaccinations: {
                      create: {
                        vaccineName: vaccination.vaccineName,
                        administeredDate: new Date(vaccination.administeredDate),
                        expiryDate: new Date(vaccination.expiryDate),
                      },
                    },
                  }
                : {}),
            }
          : {}),
      },
      include: { careNotes: true, vaccinations: true },
    });
  }

  async delete(petId: string, customerId: string) {
    await this.assertOwnership(petId, customerId);
    const upcoming = await this.prisma.booking.count({
      where: {
        petId,
        status: { notIn: ['draft', 'completed', 'cancelled', 'refunded', 'expired'] },
      },
    });
    if (upcoming > 0) {
      throw new ConflictException('This pet has an active booking. Cancel or complete it before removing the pet.');
    }
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
    const pet = await this.assertOwnership(petId, customerId);
    const vaccineName = String(data?.vaccineName ?? '').trim();
    if (!vaccineName || vaccineName.length > 100) throw new BadRequestException('vaccineName is required (max 100 chars)');
    resolveVaccination(pet.species, pet.dateOfBirth ? pet.dateOfBirth.toISOString().slice(0, 10) : null, {
      lastVaccinationDate: data?.administeredDate,
    });
    if (data.expiryDate && data.expiryDate < data.administeredDate) {
      throw new BadRequestException('expiryDate: cannot be before the vaccination date');
    }
    const [row] = await this.prisma.$transaction([
      this.prisma.petVaccination.create({
        data: {
          petId,
          vaccineName,
          administeredDate: new Date(data.administeredDate),
          expiryDate: data.expiryDate
            ? new Date(data.expiryDate)
            : new Date(addDays(data.administeredDate, VACCINATION_VALIDITY_DAYS)),
          vetName: data.vetName ?? null,
          certificateUrl: data.certificateUrl ?? null,
        },
      }),
      this.prisma.pet.update({ where: { id: petId }, data: { vaccinationStatus: 'recorded' } }),
    ]);
    return row;
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
