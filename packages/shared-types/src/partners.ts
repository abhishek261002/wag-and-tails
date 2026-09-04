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
  partnerId: string;
  totalEarnings: number;
  pendingPayout: number;
  lastPayoutAt: string | null;
  thisMonth: number;
  thisWeek: number;
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
}
