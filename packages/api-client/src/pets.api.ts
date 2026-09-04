import type { ApiClient } from './client.js';
import type { Pet, PetDetail, PetCareNote, PetVaccination, CreatePetInput, UpdatePetInput } from '@wag/shared-types';

export class PetsApi {
  constructor(private client: ApiClient) {}

  list(): Promise<Pet[]> {
    return this.client.get('/pets');
  }

  get(petId: string): Promise<PetDetail> {
    return this.client.get(`/pets/${petId}`);
  }

  create(data: CreatePetInput): Promise<Pet> {
    return this.client.post('/pets', data);
  }

  update(petId: string, data: UpdatePetInput): Promise<Pet> {
    return this.client.patch(`/pets/${petId}`, data);
  }

  delete(petId: string): Promise<void> {
    return this.client.delete(`/pets/${petId}`);
  }

  addCareNote(petId: string, note: string): Promise<PetCareNote> {
    return this.client.post(`/pets/${petId}/care-notes`, { note });
  }

  addVaccination(petId: string, data: Omit<PetVaccination, 'id' | 'petId'>): Promise<PetVaccination> {
    return this.client.post(`/pets/${petId}/vaccinations`, data);
  }

  uploadAvatar(petId: string, formData: FormData): Promise<{ avatarUrl: string }> {
    return this.client.post(`/pets/${petId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
}
