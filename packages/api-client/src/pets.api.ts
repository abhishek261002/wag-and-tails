import type { ApiClient } from './client.js';
import type { Pet, PetDetail, PetCareNote, PetVaccination, CreatePetInput, UpdatePetInput, PetMedicalRecord, MedicalRecordInput } from '@wag/shared-types';
import { appendFile } from './multipart.js';

export interface GroomingHistoryEntry {
  id: string;
  packageName: string;
  /** ISO date of the visit. */
  date: string | null;
  partnerName: string | null;
  /** The customer's rating of that visit, if they left one. */
  rating: number | null;
  /** Photos the partner took on arrival and after the session (paths under /uploads). */
  beforePhotos: string[];
  afterPhotos: string[];
}

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

  updateCareNote(petId: string, noteId: string, note: string): Promise<PetCareNote> {
    return this.client.patch(`/pets/${petId}/care-notes/${noteId}`, { note });
  }

  deleteCareNote(petId: string, noteId: string): Promise<void> {
    return this.client.delete(`/pets/${petId}/care-notes/${noteId}`);
  }

  /** Finished grooming sessions, newest first, with before/after photos. */
  groomingHistory(petId: string): Promise<GroomingHistoryEntry[]> {
    return this.client.get(`/pets/${petId}/grooming-history`);
  }

  listMedicalRecords(petId: string): Promise<PetMedicalRecord[]> {
    return this.client.get(`/pets/${petId}/medical-records`);
  }

  addMedicalRecord(petId: string, data: MedicalRecordInput): Promise<PetMedicalRecord> {
    return this.client.post(`/pets/${petId}/medical-records`, data);
  }

  updateMedicalRecord(petId: string, recordId: string, data: Partial<MedicalRecordInput>): Promise<PetMedicalRecord> {
    return this.client.patch(`/pets/${petId}/medical-records/${recordId}`, data);
  }

  deleteMedicalRecord(petId: string, recordId: string): Promise<void> {
    return this.client.delete(`/pets/${petId}/medical-records/${recordId}`);
  }

  deleteVaccination(petId: string, vaccinationId: string): Promise<void> {
    return this.client.delete(`/pets/${petId}/vaccinations/${vaccinationId}`);
  }

  addVaccination(petId: string, data: Omit<PetVaccination, 'id' | 'petId'>): Promise<PetVaccination> {
    return this.client.post(`/pets/${petId}/vaccinations`, data);
  }

  // The generic /files/upload endpoint stores the file and returns its URL;
  // the pet's avatarUrl is then set in a separate call, since /pets/:id/avatar
  // only accepts a URL, not a file body.
  //
  // The file is attached with appendFile (multipart.ts), which uses the { uri, name, type } shape React Native needs
  // on a phone and a real Blob on the web.
  async uploadAvatar(
    petId: string,
    file: { uri: string; name: string; type: string }
  ): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    await appendFile(formData, 'file', file);
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
