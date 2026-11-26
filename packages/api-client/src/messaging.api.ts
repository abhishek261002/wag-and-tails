import type { ApiClient } from './client.js';
import type { Conversation, Message, SendMessageInput } from '@wag/shared-types';
import { appendFile } from './multipart.js';

export class MessagingApi {
  constructor(private client: ApiClient) {}

  listConversations(): Promise<Conversation[]> {
    return this.client.get('/messaging/conversations');
  }

  getOrCreateConversation(bookingId: string): Promise<Conversation> {
    return this.client.post('/messaging/conversations', { bookingId });
  }

  getMessages(conversationId: string, before?: string): Promise<Message[]> {
    return this.client.get(`/messaging/conversations/${conversationId}/messages`, {
      params: { before },
    });
  }

  sendMessage(data: SendMessageInput): Promise<Message> {
    return this.client.post(
      `/messaging/conversations/${data.conversationId}/messages`,
      { content: data.content, attachmentUrl: data.attachmentUrl, attachmentType: data.attachmentType }
    );
  }

  // Uploads an attachment (image, for now) via the generic /files/upload
  // endpoint and returns its URL — same recipe as PetsApi.uploadAvatar
  // (uses appendFile, see multipart.ts).
  async uploadAttachment(
    conversationId: string,
    file: { uri: string; name: string; type: string }
  ): Promise<{ url: string }> {
    const formData = new FormData();
    await appendFile(formData, 'file', file);
    formData.append('entity', 'conversation');
    formData.append('entityId', conversationId);

    return this.client.post<{ url: string; id: string }>(
      '/files/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  }

  markRead(conversationId: string): Promise<void> {
    return this.client.patch(`/messaging/conversations/${conversationId}/read`);
  }
}
