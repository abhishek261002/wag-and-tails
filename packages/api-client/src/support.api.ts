import type { ApiClient } from './client.js';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  resolvedAt: string | null;
  escalated: boolean;
  escalatedAt: string | null;
  escalatedReason: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { profile?: { firstName: string; lastName: string } | null; phone?: string; email?: string | null };
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  isRead: boolean;
  sentAt: string;
}

export class SupportApi {
  constructor(private client: ApiClient) {}

  createTicket(data: { subject: string; description: string }): Promise<SupportTicket> {
    return this.client.post('/support/tickets', data);
  }

  // Customer/partner: their own tickets. Staff/admin: pass filters to scope
  // the queue — e.g. { escalated: true } for the admin console.
  listTickets(filters?: { status?: string; escalated?: boolean }): Promise<SupportTicket[]> {
    return this.client.get('/support/tickets', { params: filters });
  }

  getTicket(ticketId: string): Promise<SupportTicket> {
    return this.client.get(`/support/tickets/${ticketId}`);
  }

  updateStatus(ticketId: string, status: string): Promise<SupportTicket> {
    return this.client.patch(`/support/tickets/${ticketId}/status`, { status });
  }

  escalate(ticketId: string, reason: string): Promise<SupportTicket> {
    return this.client.patch(`/support/tickets/${ticketId}/escalate`, { reason });
  }

  getOrCreateConversation(ticketId: string): Promise<{ id: string }> {
    return this.client.post(`/support/tickets/${ticketId}/conversation`);
  }

  getMessages(ticketId: string): Promise<SupportMessage[]> {
    return this.client.get(`/support/tickets/${ticketId}/messages`);
  }

  sendMessage(ticketId: string, data: { content: string; attachmentUrl?: string; attachmentType?: string }): Promise<SupportMessage> {
    return this.client.post(`/support/tickets/${ticketId}/messages`, data);
  }

  // Same fetch-to-blob recipe as MessagingApi.uploadAttachment.
  async uploadAttachment(ticketId: string, file: { uri: string; name: string; type: string }): Promise<{ url: string }> {
    const blob = await (await fetch(file.uri)).blob();

    const formData = new FormData();
    formData.append('file', blob, file.name);
    formData.append('entity', 'support_ticket');
    formData.append('entityId', ticketId);

    return this.client.post<{ url: string; id: string }>(
      '/files/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  }
}
