export type NotificationType =
  | 'booking_confirmed'
  | 'booking_assigned'
  | 'booking_status_changed'
  | 'partner_on_the_way'
  | 'job_completed'
  | 'walk_started'
  | 'walk_completed'
  | 'walk_request'
  | 'message_received'
  | 'payment_completed'
  | 'refund_processed'
  | 'order_status_changed'
  | 'payout_processed'
  | 'review_received'
  | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string> | null;
  isRead: boolean;
  createdAt: string;
}

export interface PushToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: string;
}
