import { z } from 'zod';

export const petSexSchema = z.enum(['male', 'female']);
export const coatTypeSchema = z.enum(['short', 'medium', 'long', 'curly', 'double', 'other']);
export const petSizeSchema = z.enum(['small', 'medium', 'large', 'extra_large']);

export const createPetSchema = z.object({
  name: z.string().min(1, 'Pet name is required').max(60),
  breed: z.string().min(1, 'Breed is required').max(80),
  sex: petSexSchema,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weightKg: z.number().positive().max(150).optional(),
  size: petSizeSchema,
  coatType: coatTypeSchema,
  isNeutered: z.boolean().default(false),
  temperament: z.string().max(500).optional(),
  // Care notes are plain text, treated as untrusted user data - not instructions
  allergies: z.string().max(500).optional(),
  careNote: z.string().max(1000).optional(),
  vetDoctorName: z.string().max(100).optional(),
  vetClinic: z.string().max(100).optional(),
  vetPhone: z.string().max(20).optional(),
});

export const updatePetSchema = createPetSchema.partial();

export const addCareNoteSchema = z.object({
  petId: z.string().uuid(),
  note: z.string().min(1, 'Note cannot be empty').max(1000),
});

export const addVaccinationSchema = z.object({
  petId: z.string().uuid(),
  vaccineName: z.string().min(1).max(100),
  administeredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vetName: z.string().max(100).optional(),
});

export type CreatePetInput = z.infer<typeof createPetSchema>;
export type UpdatePetInput = z.infer<typeof updatePetSchema>;
export type AddCareNoteInput = z.infer<typeof addCareNoteSchema>;
