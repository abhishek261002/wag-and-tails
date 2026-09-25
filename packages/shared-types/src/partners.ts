import type { DuesStatus, EarningsJob } from './commission.js';
export type PartnerMode = 'grooming' | 'walking';
export type PartnerStatus = 'pending' | 'approved' | 'suspended' | 'rejected';
export type PartnerAvailabilityDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Partner {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  status: PartnerStatus;
  modes: PartnerMode[];
  city: string | null;
  // KYC details collected at sign-up, reviewed by staff before approval.
  age: number | null;
  address: string | null;
  aadhaarNumber: string | null;
  photoUrl: string | null;
  serviceRadiusKm: number;
  isOnline: boolean;
  currentLat: number | null;
  currentLng: number | null;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  joinedAt: string;
}

export interface PartnerAvailability {
  partnerId: string;
  day: PartnerAvailabilityDay;
  startTime: string; // "HH:MM"
  endTime: string;
}

export interface PartnerDocument {
  id: string;
  partnerId: string;
  docType: string;
  fileUrl: string;
  verifiedAt: string | null;
}

export interface PartnerEarnings {
  /** Paid out so far / waiting to be paid out (payouts of online bookings). */
  total: number;
  pending: number;
  payouts: Array<{ id: string; netAmount: number | string; status: string; createdAt: string }>;
  completedJobs: number;
  /** What customers paid for completed jobs, and how it splits at each job's own ratio. */
  totalCollected: number;
  yourShare: number;
  companyShare: number;
  collectedInCash: number;
  collectedOnline: number;
  dues: DuesStatus;
  recent: EarningsJob[];
}

export interface PayoutRequest {
  id: string;
  partnerId: string;
  amount: number;
  status: 'pending' | 'requested' | 'approved' | 'processing' | 'paid' | 'failed';
  requestedAt: string;
  processedAt: string | null;
}

export interface PartnerJobCard {
  bookingId: string;
  type: 'grooming' | 'walking';
  petName: string;
  petSpecies?: 'dog' | 'cat';
  petBreed: string;
  petSize: string;
  petWeightKg: number | null;
  petCareNotes: string | null;
  customerName: string;
  customerRating: number;
  addressLine: string;
  distanceKm: number;
  scheduledAt: string;
  packageName?: string;
  addOns?: string[];
  durationMinutes?: number;
  partnerPayout: number;
  status: string;
  /** The customer chose this partner specifically; declining tells the customer to pick someone else. */
  isDirectRequest?: boolean;
  requestExpiresAt?: string | null;
}
