import type { ApiClient } from './client.js';
import type { Conversation, Message, SendMessageInput } from '@wag/shared-types';

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
      { content: data.content, attachmentUrl: data.attachmentUrl }
    );
  }

  markRead(conversationId: string): Promise<void> {
    return this.client.patch(`/messaging/conversations/${conversationId}/read`);
  }
}
