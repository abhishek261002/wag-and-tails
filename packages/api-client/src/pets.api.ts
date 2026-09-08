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
  //
  // The RN-specific FormData shape (`{ uri, name, type }` appended
  // directly) only works with React Native's native networking layer — on
  // web (react-native-web + a real browser XHR) it needs an actual
  // Blob/File. Fetching the picker's uri and converting to a blob works
  // identically on both platforms (RN's fetch supports file:// URIs too),
  // so there's no need to branch on Platform.OS here.
  async uploadAvatar(
    petId: string,
    file: { uri: string; name: string; type: string }
  ): Promise<{ avatarUrl: string }> {
    const blob = await (await fetch(file.uri)).blob();

    const formData = new FormData();
    formData.append('file', blob, file.name);
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
