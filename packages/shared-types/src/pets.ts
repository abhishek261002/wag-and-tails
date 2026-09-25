import type { PetSpecies, PetSize, CoatType, VaccinationStatus } from './species.js';

export type PetSex = 'male' | 'female';

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
  // Mandatory answer: either the date of the last vaccination, or the explicit
  // "not vaccinated yet" (puppies/kittens). Exactly one of the two must be given.
  lastVaccinationDate?: string;
  lastVaccineName?: string;
  notVaccinatedYet?: boolean;
}

export interface UpdatePetInput extends Partial<CreatePetInput> {}
