import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import {
  BREEDS_BY_SPECIES,
  COAT_OPTIONS_BY_SPECIES,
  DEFAULT_VACCINE_BY_SPECIES,
  VACCINATION_VALIDITY_DAYS,
  type PetSpecies,
} from '../common/species.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// "Today" as the owner sees it (IST), so a vaccination logged at 11pm isn't rejected as future-dated.
export function todayIst(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(isoDate: string, days: number): string {
  return new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + days * MS_DAY).toISOString().slice(0, 10);
}

const dateField = (label: string) =>
  z.string().refine(isRealDate, { message: `${label} must be a valid date (YYYY-MM-DD)` });

const trimmed = (max: number) => z.string().trim().max(max).nullish();

const baseFields = {
  species: z.enum(['dog', 'cat']),
  name: z.string().trim().min(1, 'Pet name is required').max(60),
  breed: z.string().trim().min(1, 'Breed is required').max(80),
  sex: z.enum(['male', 'female']),
  dateOfBirth: dateField('Date of birth').optional(),
  weightKg: z.number().positive('Weight must be positive').optional(),
  size: z.enum(['small', 'medium', 'large', 'extra_large']).optional(),
  coatType: z.enum(['short', 'medium', 'long', 'curly', 'double', 'hairless', 'other']),
  isNeutered: z.boolean().optional(),
  temperament: trimmed(500).optional(),
  allergies: trimmed(500).optional(),
  careNote: trimmed(1000).optional(),
  vetDoctorName: trimmed(100).optional(),
  vetClinic: trimmed(100).optional(),
  vetPhone: trimmed(20).optional(),
  lastVaccinationDate: dateField('Last vaccination date').optional(),
  lastVaccineName: trimmed(100).optional(),
  notVaccinatedYet: z.boolean().optional(),
};

export const createPetSchema = z.object(baseFields);
// Species is fixed once a pet exists (a wrong choice is fixed by re-adding the pet).
export const updatePetSchema = z.object({ ...baseFields }).partial().omit({ species: true });

export type CreatePetDto = z.infer<typeof createPetSchema>;
export type UpdatePetDto = z.infer<typeof updatePetSchema>;

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') || 'body';
    throw new BadRequestException(`${path}: ${first?.message ?? 'invalid'}`);
  }
  return result.data;
}

// Cross-field rules that depend on the species (or on other fields) live here.
export function assertPetRules(
  species: PetSpecies,
  d: Partial<Pick<CreatePetDto, 'breed' | 'coatType' | 'weightKg' | 'dateOfBirth'>>,
) {
  if (d.breed !== undefined && !BREEDS_BY_SPECIES[species].some((b) => b.toLowerCase() === d.breed!.toLowerCase())) {
    throw new BadRequestException(`breed: "${d.breed}" is not a valid ${species} breed`);
  }
  if (d.coatType !== undefined && !COAT_OPTIONS_BY_SPECIES[species].some((c) => c.value === d.coatType) && d.coatType !== 'other') {
    throw new BadRequestException(`coatType: "${d.coatType}" is not available for ${species}s`);
  }
  const maxWeight = species === 'cat' ? 15 : 150;
  if (d.weightKg !== undefined && d.weightKg > maxWeight) {
    throw new BadRequestException(`weightKg: must be at most ${maxWeight} kg for a ${species}`);
  }
  if (d.dateOfBirth !== undefined) {
    const today = todayIst();
    if (d.dateOfBirth > today) throw new BadRequestException('dateOfBirth: cannot be in the future');
    if (d.dateOfBirth < addDays(today, -365 * 30)) throw new BadRequestException('dateOfBirth: too far in the past');
  }
}

export interface VaccinationInput {
  lastVaccinationDate?: string;
  lastVaccineName?: string | null;
  notVaccinatedYet?: boolean;
}

// Returns null for "not vaccinated yet", otherwise the row to create.
export function resolveVaccination(
  species: PetSpecies,
  dateOfBirth: string | null | undefined,
  v: VaccinationInput,
): { vaccineName: string; administeredDate: string; expiryDate: string } | null {
  const hasDate = !!v.lastVaccinationDate;
  if (hasDate === !!v.notVaccinatedYet) {
    throw new BadRequestException('Tell us when the last vaccination was, or choose "Not vaccinated yet"');
  }
  if (!hasDate) return null;

  const date = v.lastVaccinationDate!;
  const today = todayIst();
  if (date > today) throw new BadRequestException('lastVaccinationDate: cannot be in the future');
  if (date < addDays(today, -365 * 15)) throw new BadRequestException('lastVaccinationDate: too far in the past');
  if (dateOfBirth && date < dateOfBirth) {
    throw new BadRequestException('lastVaccinationDate: cannot be before the pet was born');
  }
  return {
    vaccineName: v.lastVaccineName?.trim() || DEFAULT_VACCINE_BY_SPECIES[species],
    administeredDate: date,
    expiryDate: addDays(date, VACCINATION_VALIDITY_DAYS),
  };
}
