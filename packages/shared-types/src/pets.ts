import type { PetSpecies, PetSize, CoatType, VaccinationStatus } from './species.js';

export type PetSex = 'male' | 'female';

import type { PetMedicalRecord } from './medical.js';
import type { VaccinationSummary } from './vaccination.js';

export interface Pet {
  id: string;
  customerId: string;
  species: PetSpecies;
  name: string;
  breed: string;
  sex: PetSex;
  dateOfBirth: string | null;
  weightKg: number | null;
  size: PetSize;
  coatType: CoatType;
  isNeutered: boolean;
  temperament: string | null;
  allergies: string | null;
  vaccinationStatus: VaccinationStatus;
  avatarUrl: string | null;
  /** Completed visits; only on the pets list. */
  visitCount?: number;
  /** "Vaccinated" / "Booster due" at a glance; only on the pets list and detail. */
  vaccination?: VaccinationSummary;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PetCareNote {
  id: string;
  petId: string;
  note: string;
  addedBy: string; // userId
  addedByRole: string;
  createdAt: string;
}

export interface PetVaccination {
  id: string;
  petId: string;
  vaccineName: string;
  administeredDate: string;
  expiryDate: string | null;
  vetName: string | null;
  certificateUrl: string | null;
}

export interface VetInfo {
  vetDoctorName: string | null;
  vetClinic: string | null;
  vetPhone: string | null;
}

export interface PetDetail extends Pet, VetInfo {
  careNotes: PetCareNote[];
  vaccinations: PetVaccination[];
  medicalRecords?: PetMedicalRecord[];
  groomingCount: number;
  walkingCount: number;
  lastGroomedAt: string | null;
  lastWalkedAt: string | null;
}

export interface CreatePetInput {
  species: PetSpecies;
  name: string;
  breed: string;
  sex: PetSex;
  dateOfBirth?: string;
  weightKg?: number;
  size: PetSize;
  coatType: CoatType;
  isNeutered?: boolean;
  temperament?: string;
  allergies?: string;
  careNote?: string;
  vetDoctorName?: string;
  vetClinic?: string;
  vetPhone?: string;
  // Optional: the date of the last vaccination, or the explicit "not vaccinated yet"
  // (puppies/kittens), or neither (status stays unknown). Never both.
  lastVaccinationDate?: string;
  lastVaccineName?: string;
  notVaccinatedYet?: boolean;
}

export interface UpdatePetInput extends Partial<CreatePetInput> {}
