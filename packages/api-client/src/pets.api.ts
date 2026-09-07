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

  // The generic /files/upload endpoint stores the file and returns its URL;
  // the pet's avatarUrl is then set in a separate call, since /pets/:id/avatar
  // only accepts a URL, not a file body.
  async uploadAvatar(
    petId: string,
    file: { uri: string; name: string; type: string }
  ): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    formData.append('entity', 'pet');
    formData.append('entityId', petId);

    const uploaded = await this.client.post<{ url: string; id: string }>(
      '/files/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    await this.client.patch(`/pets/${petId}/avatar`, { avatarUrl: uploaded.url });
    return { avatarUrl: uploaded.url };
  }
}
