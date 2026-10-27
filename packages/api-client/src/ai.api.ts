import type { ApiClient } from './client.js';
import type { AiChatRequest, AiChatResponse, AiChatSession, DrWoofSessionSummary } from '@wag/shared-types';

export class AiApi {
  constructor(private client: ApiClient) {}

  chat(data: AiChatRequest): Promise<AiChatResponse> {
    return this.client.post('/ai/pet-chat', data);
  }

  /** Dr. Woof: one assistant that knows all of the customer's pets. Omit sessionId to start a new conversation. */
  drWoof(message: string, sessionId?: string, imageUrl?: string): Promise<AiChatResponse> {
    return this.client.post('/ai/dr-woof', { message, ...(sessionId ? { sessionId } : {}), ...(imageUrl ? { imageUrl } : {}) });
  }

  /** Past Dr. Woof chats, newest first (title, preview, count). */
  drWoofSessions(): Promise<DrWoofSessionSummary[]> {
    return this.client.get('/ai/dr-woof/sessions');
  }

  deleteDrWoofSession(sessionId: string): Promise<{ deleted: boolean }> {
    return this.client.delete(`/ai/dr-woof/sessions/${sessionId}`);
  }

  /** What the chat may offer (photos are switched on or off on the server). */
  drWoofConfig(): Promise<{ imagesEnabled: boolean }> {
    return this.client.get('/ai/dr-woof/config');
  }

  /** Uploads a photo for a Dr. Woof message and returns its path, to send with `drWoof(..., imageUrl)`. */
  async uploadDrWoofImage(file: { uri: string; name: string; type: string }): Promise<{ url: string }> {
    const blob = await (await fetch(file.uri)).blob();
    const formData = new FormData();
    formData.append('file', blob, file.name);
    formData.append('entity', 'dr_woof');
    formData.append('entityId', 'chat');
    const uploaded = await this.client.post<{ url: string }>('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return { url: uploaded.url };
  }

  getSessions(petId: string): Promise<AiChatSession[]> {
    return this.client.get('/ai/sessions', { params: { petId } });
  }

  getSessionMessages(sessionId: string): Promise<AiChatResponse['message'][]> {
    return this.client.get(`/ai/sessions/${sessionId}/messages`);
  }
}
