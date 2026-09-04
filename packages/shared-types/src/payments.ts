export type PayoutStatus = 'pending' | 'requested' | 'approved' | 'processing' | 'paid' | 'failed';

export interface Payment {
  id: string;
  bookingId: string | null;
  orderId: string | null;
  userId: string;
  amount: number;
  currency: string;
  method: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
  providerPaymentId: string | null;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  providerRefundId: string | null;
  createdAt: string;
}

export interface Payout {
  id: string;
  partnerId: string;
  batchId: string | null;
  bookingId: string | null;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  status: PayoutStatus;
  requestedAt: string | null;
  paidAt: string | null;
  notes: string | null;
}

export interface PayoutBatch {
  id: string;
  createdBy: string;
  totalAmount: number;
  payoutCount: number;
  status: PayoutStatus;
  processedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  applicableServices: string[]; // 'grooming' | 'walking' | 'store' | 'all'
  usageLimitTotal: number | null;
  usageLimitPerUser: number | null;
  timesUsed: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}
