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
  createdAt: string;
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
