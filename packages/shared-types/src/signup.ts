// Customer sign-up: the shape the app sends and the rules both sides share.
import type { PetSpecies } from './species.js';

/** Cities we operate in; the sign-up form offers these first (any other city can be typed). */
export const OPERATING_CITIES = ['Kanpur', 'Lucknow', 'Delhi'] as const;

/** At least one pet is required at sign-up; more can be added later from the Pets tab. */
export const MIN_SIGNUP_PETS = 1;
export const MAX_SIGNUP_PETS = 5;
export const MAX_PET_AGE_YEARS = 30;

export interface SignupPetInput {
  name: string;
  species: PetSpecies;
  breed: string;
  sex: 'male' | 'female';
  /** Whole years (0-30). */
  ageYears: number;
  /** Extra months (0-11). */
  ageMonths: number;
}

export interface CustomerSignupRequest {
  phone: string;
  otp: string;
  /** Full name as typed, e.g. "Aarav Mehta". */
  name: string;
  city: string;
  /** Optional at sign-up. */
  email?: string;
  pets: SignupPetInput[];
}

/**
 * An approximate date of birth from an age in years and months, as YYYY-MM-DD. Uses calendar arithmetic (the 31st
 * of a short month becomes that month's last day) so "1 month" on 31 March is 28/29 February, not 3 March.
 */
export function dobFromAge(ageYears: number, ageMonths: number, today: Date = new Date()): string {
  const totalMonths = Math.max(0, Math.floor(ageYears) * 12 + Math.floor(ageMonths));
  const y = today.getFullYear();
  const m = today.getMonth() - totalMonths;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const d = new Date(targetYear, targetMonth, Math.min(today.getDate(), lastDay));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Mary Ann Lee" -> first "Mary Ann", last "Lee"; a single word is a first name with no last name. */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const t = full.trim().replace(/\s+/g, ' ');
  const i = t.lastIndexOf(' ');
  return i === -1 ? { firstName: t, lastName: '' } : { firstName: t.slice(0, i), lastName: t.slice(i + 1) };
}
