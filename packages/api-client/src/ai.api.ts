import type { ApiClient } from './client.js';
import type { AiChatRequest, AiChatResponse, AiChatSession } from '@wag/shared-types';

export class AiApi {
  constructor(private client: ApiClient) {}

  chat(data: AiChatRequest): Promise<AiChatResponse> {
    return this.client.post('/ai/pet-chat', data);
  }

  /** Dr. Woof: one assistant that knows all of the customer's pets. Omit sessionId to start a new conversation. */
  drWoof(message: string, sessionId?: string): Promise<AiChatResponse> {
    return this.client.post('/ai/dr-woof', { message, ...(sessionId ? { sessionId } : {}) });
  }

  drWoofSessions(): Promise<Array<{ id: string; updatedAt: string }>> {
    return this.client.get('/ai/dr-woof/sessions');
  }

  getSessions(petId: string): Promise<AiChatSession[]> {
    return this.client.get('/ai/sessions', { params: { petId } });
  }

  getSessionMessages(sessionId: string): Promise<AiChatResponse['message'][]> {
    return this.client.get(`/ai/sessions/${sessionId}/messages`);
  }
}
