// Single source of truth for species-specific rules. Pure TS with no imports so the
// API (via a relative import), both mobile apps and the web consoles all share it.

export type PetSpecies = 'dog' | 'cat';
export type PetSize = 'small' | 'medium' | 'large' | 'extra_large';
export type CoatType = 'short' | 'medium' | 'long' | 'curly' | 'double' | 'hairless' | 'other';
export type ServiceType = 'grooming' | 'walking';
export type VaccinationStatus = 'recorded' | 'not_vaccinated_yet' | 'unknown';

export const PET_SPECIES: PetSpecies[] = ['dog', 'cat'];

export const SPECIES_LABEL: Record<PetSpecies, string> = { dog: 'Dog', cat: 'Cat' };

export const DOG_BREEDS = [
  'Indie', 'Indian Spitz', 'Labrador', 'Golden Retriever', 'German Shepherd', 'Beagle',
  'Shih Tzu', 'Pug', 'Pomeranian', 'Cocker Spaniel', 'Dachshund', 'Rottweiler', 'Husky',
  'Boxer', 'Doberman', 'Great Dane', 'Saint Bernard', 'Bulldog', 'French Bulldog',
  'Lhasa Apso', 'Maltese', 'Border Collie', 'Samoyed', 'Chow Chow', 'Dalmatian', 'Akita',
  'Rajapalayam', 'Mixed', 'Other',
];

export const CAT_BREEDS = [
  'Indie / Domestic Shorthair', 'Persian', 'Siamese', 'Maine Coon', 'Bengal', 'Ragdoll',
  'British Shorthair', 'Russian Blue', 'Scottish Fold', 'Sphynx', 'Himalayan', 'Abyssinian',
  'Birman', 'Burmese', 'Norwegian Forest', 'Mixed', 'Other',
];

export const BREEDS_BY_SPECIES: Record<PetSpecies, string[]> = { dog: DOG_BREEDS, cat: CAT_BREEDS };

export const COAT_OPTIONS_BY_SPECIES: Record<PetSpecies, { label: string; value: CoatType }[]> = {
  dog: [
    { label: 'Short', value: 'short' },
    { label: 'Medium', value: 'medium' },
    { label: 'Long', value: 'long' },
    { label: 'Curly', value: 'curly' },
    { label: 'Double', value: 'double' },
  ],
  cat: [
    { label: 'Short', value: 'short' },
    { label: 'Medium', value: 'medium' },
    { label: 'Long', value: 'long' },
    { label: 'Hairless', value: 'hairless' },
  ],
};

// Groom pricing bands are derived from weight, and cats weigh far less than dogs.
export function sizeFromWeight(species: PetSpecies, weightKg: number): PetSize {
  if (species === 'cat') {
    if (weightKg <= 3.5) return 'small';
    if (weightKg <= 6) return 'medium';
    if (weightKg <= 8) return 'large';
    return 'extra_large';
  }
  if (weightKg <= 8) return 'small';
  if (weightKg <= 20) return 'medium';
  if (weightKg <= 35) return 'large';
  return 'extra_large';
}

// Cats are groomed only; dogs are groomed and walked.
export const SERVICES_BY_SPECIES: Record<PetSpecies, ServiceType[]> = {
  dog: ['grooming', 'walking'],
  cat: ['grooming'],
};

export function speciesSupportsService(species: PetSpecies, service: ServiceType): boolean {
  return SERVICES_BY_SPECIES[species].includes(service);
}

export const CORE_VACCINES_BY_SPECIES: Record<PetSpecies, string[]> = {
  dog: ['DHPPiL (5-in-1)', 'Rabies', 'Kennel Cough (Bordetella)', 'Other'],
  cat: ['FVRCP (3-in-1)', 'Rabies', 'FeLV', 'Other'],
};

export const DEFAULT_VACCINE_BY_SPECIES: Record<PetSpecies, string> = {
  dog: 'DHPPiL (5-in-1)',
  cat: 'FVRCP (3-in-1)',
};

// Annual boosters are the norm for both species; used to pre-fill the next-due date.
export const VACCINATION_VALIDITY_DAYS = 365;
