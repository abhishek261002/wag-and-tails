// WebSocket event types for all realtime subscriptions

export type RealtimeEventType =
  | 'booking:created'
  | 'booking:assigned'
  | 'booking:status_changed'
  | 'partner:online'
  | 'partner:offline'
  | 'partner:location_updated'
  | 'walk:request_sent'
  | 'walk:accepted'
  | 'walk:rejected'
  | 'walk:started'
  | 'walk:completed'
  | 'walk:photo_added'
  | 'message:sent'
  | 'payment:completed'
  | 'order:status_changed'
  | 'payout:status_changed'
  | 'notification:new';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  payload: T;
  timestamp: string;
}

export interface BookingStatusChangedPayload {
  bookingId: string;
  status: string;
  partnerId?: string;
  partnerName?: string;
  updatedAt: string;
}

export interface PartnerLocationPayload {
  partnerId: string;
  bookingId?: string;
  lat: number;
  lng: number;
  heading?: number;
  timestamp: string;
}

export interface WalkRequestPayload {
  bookingId: string;
  petName: string;
  petBreed: string;
  durationMinutes: number;
  customerName: string;
  customerRating: number;
  pickupAddress: string;
  distanceKm: number;
  partnerPayout: number;
  expiresAt: string;
}

export interface MessagePayload {
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
}
