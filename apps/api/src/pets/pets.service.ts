import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BUSINESS_CONFIG } from '../common/config.js';
import { PetSex, PetSize, CoatType, PetSpecies } from '@prisma/client';
import { sizeFromWeight, VACCINATION_VALIDITY_DAYS } from '../common/species.js';
import { summarizeVaccinations } from '../common/vaccination.js';
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
    const pets = await this.prisma.pet.findMany({
      where: { customerId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        careNotes: { orderBy: { createdAt: 'desc' }, take: 1 },
        vaccinations: { select: { vaccineName: true, administeredDate: true, expiryDate: true } },
        _count: { select: { bookings: true } },
      },
    });
    // Completed visits per pet, for the "3 visits" chip.
    const visits = pets.length
      ? await this.prisma.booking.groupBy({
          by: ['petId'],
          where: { customerId, status: 'completed', petId: { in: pets.map((p) => p.id) } },
          _count: { _all: true },
        })
      : [];
    const visitCount = new Map(visits.map((v) => [v.petId, v._count._all]));
    return pets.map((p) => ({
      ...p,
      visitCount: visitCount.get(p.id) ?? 0,
      vaccination: summarizeVaccinations(p.vaccinations, p.vaccinationStatus),
    }));
  }

  /**
   * Who may see or annotate a pet: its owner; a partner who has (or had) a booking for it; staff and admins.
   * A partner with no booking for the pet must not be able to read its record or add notes to it.
   */
  private async assertCanAccess(petId: string, user: { sub: string; role: string }) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) throw new NotFoundException('Pet not found');
    if (user.role === 'staff' || user.role === 'admin') return pet;
    if (user.role === 'customer') {
      if (pet.customerId !== user.sub) throw new ForbiddenException('Access denied');
      return pet;
    }
    if (user.role === 'partner') {
      const job = await this.prisma.booking.findFirst({
        where: { petId, partnerId: user.sub, status: { in: ['assigned', 'accepted', 'partner_on_the_way', 'arrived', 'in_progress', 'completed'] } },
        select: { id: true },
      });
      if (!job) throw new ForbiddenException('Access denied');
      return pet;
    }
    throw new ForbiddenException('Access denied');
  }

  async getDetail(petId: string, requesterId: string, requesterRole: string) {
    await this.assertCanAccess(petId, { sub: requesterId, role: requesterRole });
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: {
        careNotes: { orderBy: { createdAt: 'desc' } },
        vaccinations: { orderBy: { administeredDate: 'desc' } },
      },
    });
    if (!pet) throw new NotFoundException('Pet not found');
    const visitCount = await this.prisma.booking.count({ where: { petId, status: 'completed' } });
    return { ...pet, visitCount, vaccination: summarizeVaccinations(pet.vaccinations, pet.vaccinationStatus) };
  }

  /**
   * Finished grooming sessions for a pet, newest first, with the partner, their rating for that visit, and the
   * before/after photos the partner uploaded (before on arrival, after on completion).
   */
  async groomingHistory(petId: string, user: { sub: string; role: string }) {
    if (user.role === 'partner') throw new ForbiddenException('Access denied');
    await this.assertCanAccess(petId, user);
    const rows = await this.prisma.booking.findMany({
      where: { petId, type: 'grooming', status: 'completed' },
      orderBy: [{ completedAt: 'desc' }, { scheduledAt: 'desc' }],
      take: 50,
      select: {
        id: true, packageName: true, scheduledAt: true, completedAt: true, beforePhotos: true, afterPhotos: true,
        partner: { select: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        review: { select: { rating: true } },
      },
    });
    return rows.map((r) => {
      const prof = r.partner?.user?.profile;
      return {
        id: r.id,
        packageName: r.packageName ?? 'Grooming',
        date: (r.completedAt ?? r.scheduledAt)?.toISOString() ?? null,
        partnerName: prof ? [prof.firstName, prof.lastName].filter(Boolean).join(' ') : null,
        rating: r.review?.rating ?? null,
        beforePhotos: r.beforePhotos,
        afterPhotos: r.afterPhotos,
      };
    });
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

  private cleanNote(note: unknown): string {
    const t = typeof note === 'string' ? note.trim() : '';
    if (t.length < 1) throw new BadRequestException('Please write a note');
    if (t.length > 1000) throw new BadRequestException('Notes can be up to 1000 characters');
    return t;
  }

  async addCareNote(petId: string, note: unknown, addedBy: string, addedByRole: string) {
    await this.assertCanAccess(petId, { sub: addedBy, role: addedByRole });
    return this.prisma.petCareNote.create({
      data: { petId, note: this.cleanNote(note), addedBy, addedByRole },
    });
  }

  /** A note can only be changed or removed by the person who wrote it (staff and admins may moderate). */
  private async ownNote(petId: string, noteId: string, user: { sub: string; role: string }) {
    await this.assertCanAccess(petId, user);
    const found = await this.prisma.petCareNote.findFirst({ where: { id: noteId, petId } });
    if (!found) throw new NotFoundException('Note not found');
    if (found.addedBy !== user.sub && user.role !== 'staff' && user.role !== 'admin') throw new ForbiddenException('You can only change your own notes');
    return found;
  }

  async updateCareNote(petId: string, noteId: string, note: unknown, user: { sub: string; role: string }) {
    await this.ownNote(petId, noteId, user);
    return this.prisma.petCareNote.update({ where: { id: noteId }, data: { note: this.cleanNote(note) } });
  }

  async deleteCareNote(petId: string, noteId: string, user: { sub: string; role: string }) {
    await this.ownNote(petId, noteId, user);
    await this.prisma.petCareNote.delete({ where: { id: noteId } });
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
