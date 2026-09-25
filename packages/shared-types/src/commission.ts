// Commission, partner discounts and dues. Percentages are the company's share unless noted.

export interface DuesStatus {
  /** Commission currently owed to the company (INR). Negative means the partner is in credit. */
  due: number;
  limit: number;
  /** Company share of each job, percent (30 means a 70/30 split). */
  commissionPct: number;
  /** Partner share of each job, percent. */
  partnerPct: number;
  /** True once due >= limit: no jobs are shown and claiming is refused until dues are paid. */
  blocked: boolean;
  /** True from 80% of the limit, before blocking. */
  warning: boolean;
  remaining: number;
}

export interface EarningsJob {
  bookingId: string;
  type: 'grooming' | 'walking';
  petName: string;
  completedAt: string | null;
  total: number;
  paymentMethod: string | null;
  commissionPct: number | null;
  commissionAmount: number | null;
  yourShare: number | null;
  discountAmount: number;
  discountSource: 'coupon' | 'partner' | null;
}

export interface DuesPayOrder {
  commissionPaymentId: string;
  providerOrderId: string;
  amount: number;
  /** Provider public key for the checkout SDK; null with the development mock provider. */
  keyId: string | null;
}

export type PartnerDiscountStatus = 'active' | 'inactive';

export interface PartnerDiscount {
  id: string;
  partnerId: string;
  percent: string | number;
  startsAt: string;
  endsAt: string;
  status: PartnerDiscountStatus;
  note: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  type: 'commission_due' | 'commission_paid' | 'payout_offset' | 'adjustment';
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface PlatformSettings {
  defaultCommissionPct: number;
  commissionLimit: number;
  maxPartnerDiscountPct: number;
}

/** Everything the staff/admin partner page shows about a partner's money. */
export interface PartnerMoneyOverview {
  /** Partner-specific company share; null = platform default. */
  commissionPct: number | null;
  commissionLimitOverride: number | null;
  effective: DuesStatus;
  defaults: PlatformSettings;
  activeDiscount: PartnerDiscount | null;
  discounts: PartnerDiscount[];
  ledger: LedgerEntry[];
}
