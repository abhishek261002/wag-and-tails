export interface Conversation {
  id: string;
  bookingId: string | null;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

export interface Message {
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

export interface SendMessageInput {
  conversationId: string;
  content: string;
  attachmentUrl?: string;
}
