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
  | 'job:available'
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
  // Only present on the transition into 'in_progress' — the moment the
  // partner verifies the start OTP. See PartnersService.verifyStartOtp.
  endOtp?: string;
  sessionStartedAt?: string;
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

export interface JobAvailablePayload {
  bookingId: string;
  type: string;
  petName: string;
  petBreed: string;
  scheduledAt: string | null;
  addressLine: string;
  partnerPayout: number;
}

export interface MessagePayload {
  conversationId: string;
  bookingId: string | null;
  messageId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  sentAt: string;
}
