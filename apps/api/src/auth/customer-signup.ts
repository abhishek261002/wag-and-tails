import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { MAX_PET_AGE_YEARS, MAX_SIGNUP_PETS, MIN_SIGNUP_PETS, dobFromAge, splitFullName } from '../common/signup.js';
import { assertPetRules } from '../pets/pet.schemas.js';
import { BREEDS_BY_SPECIES } from '../common/species.js';

// Letters (any script), spaces and . ' - ; must start with a letter.
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'\-]*$/u;

const petSchema = z.object({
  name: z.string().trim().min(1, 'Pet name is required').max(60, 'Pet name is too long'),
  species: z.enum(['dog', 'cat'], { errorMap: () => ({ message: 'Choose dog or cat' }) }),
  breed: z.string().trim().min(1, 'Breed is required').max(80),
  sex: z.enum(['male', 'female'], { errorMap: () => ({ message: 'Choose male or female' }) }),
  ageYears: z.number().int('Age must be whole years').min(0).max(MAX_PET_AGE_YEARS, `Age can be at most ${MAX_PET_AGE_YEARS} years`),
  ageMonths: z.number().int('Months must be a whole number').min(0).max(11, 'Months must be 0 to 11'),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120, 'That name is too long')
    .refine((v) => NAME_RE.test(v.replace(/\s+/g, ' ')), "Names can only contain letters, spaces and . ' -"),
  city: z.string().trim().min(2, 'Please enter your city').max(60, 'That city name is too long')
    .refine((v) => NAME_RE.test(v), 'Please enter a valid city name'),
  email: z.string().trim().toLowerCase().max(254).email('Please enter a valid email address').optional().or(z.literal('').transform(() => undefined)),
  pets: z.array(petSchema, { invalid_type_error: 'Add at least one pet' })
    .min(MIN_SIGNUP_PETS, 'Add at least one pet')
    .max(MAX_SIGNUP_PETS, `You can add up to ${MAX_SIGNUP_PETS} pets now and more later`),
});

export interface PreparedSignup {
  firstName: string;
  lastName: string;
  city: string;
  email: string | null;
  pets: Array<{ name: string; species: 'dog' | 'cat'; breed: string; sex: 'male' | 'female'; dateOfBirth: string }>;
}

/** Validates and normalises a customer sign-up. Throws a 400 naming the first problem (e.g. "pets.1.breed: ..."). */
export function prepareSignup(body: unknown, today: Date = new Date()): PreparedSignup {
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
    throw new BadRequestException(`${where}${issue.message}`);
  }
  const d = parsed.data;
  const { firstName, lastName } = splitFullName(d.name);
  const city = d.city.replace(/\s+/g, ' ');

  const pets = d.pets.map((p, i) => {
    // The breed must be one the app offers for that species (same rule as adding a pet later).
    try {
      assertPetRules(p.species, { breed: p.breed });
    } catch (err) {
      throw new BadRequestException(`pets.${i}.${(err as Error).message}`);
    }
    // Store the canonical spelling of the breed.
    return {
      name: p.name.replace(/\s+/g, ' '),
      species: p.species,
      breed: BREEDS_BY_SPECIES[p.species].find((b) => b.toLowerCase() === p.breed.toLowerCase()) ?? p.breed,
      sex: p.sex,
      dateOfBirth: dobFromAge(p.ageYears, p.ageMonths, today),
    };
  });

  return { firstName, lastName, city, email: d.email ?? null, pets };
}
