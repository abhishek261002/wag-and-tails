import type { ApiClient } from './client.js';
import type { AiChatRequest, AiChatResponse, AiChatSession } from '@wag/shared-types';

export class AiApi {
  constructor(private client: ApiClient) {}

  chat(data: AiChatRequest): Promise<AiChatResponse> {
    return this.client.post('/ai/pet-chat', data);
  }

  getSessions(petId: string): Promise<AiChatSession[]> {
    return this.client.get('/ai/sessions', { params: { petId } });
  }

  getSessionMessages(sessionId: string): Promise<AiChatResponse['message'][]> {
    return this.client.get(`/ai/sessions/${sessionId}/messages`);
  }
}
