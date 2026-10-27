export interface AiChatSession {
  id: string;
  petId: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  refusalReason: string | null;
  suggestedActions: string[];
  /** A photo the customer attached (a path under /uploads); only in Dr. Woof chats with photos enabled. */
  imageUrl?: string | null;
  createdAt: string;
}

/** One row of the Dr. Woof History screen. */
export interface DrWoofSessionSummary {
  id: string;
  /** The first thing the customer asked. */
  title: string;
  /** The latest message in the chat. */
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatRequest {
  petId: string;
  message: string;
  sessionId?: string;
}

export interface AiChatResponse {
  sessionId: string;
  message: AiChatMessage;
}
