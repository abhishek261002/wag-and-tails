import type { Address } from './location.js';

export type GroomingBookingStatus =
  | 'draft'
  | 'pending_payment'
  | 'confirmed'
  | 'needs_partner'
  | 'assigned'
  | 'partner_on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type WalkingBookingStatus =
  | 'draft'
  | 'searching_partner'
  | 'accepted'
  | 'partner_on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type BookingType = 'grooming' | 'walking';
export type BookingChannel = 'app' | 'whatsapp' | 'phone_call' | 'instagram' | 'walk_in' | 'other';
export type PaymentMethod = 'upi' | 'card' | 'wallet' | 'cash_after_service';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface GroomingPackage {
  id: string;
  name: string;
  mrp: number;
  price: number;
  description: string | null;
  inclusions: string[];
  isActive: boolean;
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  description: string | null;
  isActive: boolean;
}

export interface WalkPricing {
  id: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export type AssignmentMode = 'any' | 'specific';

/** open: anyone may claim. awaiting_partner: reserved for the chosen partner. rejected/expired: customer must choose again. */
export type DispatchState = 'open' | 'awaiting_partner' | 'rejected' | 'expired';

export interface BookingDispatchInfo {
  mode: AssignmentMode;
  state: DispatchState;
  requestedPartnerId: string | null;
  requestedPartnerName: string | null;
  expiresAt: string | null;
  ttlMinutes: number;
}

/** A partner card shown at checkout. */
export interface PartnerOption {
  partnerId: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  bio: string | null;
  isOnline: boolean;
  isPast: boolean;
  timesBookedByYou: number;
  lastBookedAt: string | null;
  /** Percent off the service price this partner is offering right now (staff-approved, in its window). */
  discountPct: number | null;
}

export interface Booking {
  dispatch?: BookingDispatchInfo;
  id: string;
  type: BookingType;
  customerId: string;
  petId: string;
  petName: string;
  petSpecies?: "dog" | "cat";
  petBreed: string;
  petSize: string;
  petCareNotes: string | null;
  /** Stored photo URLs (relative /uploads/... or absolute). Before-photos are required before the session can start. */
  beforePhotos?: string[];
  /** Set when a partner claims the job: their discount, which discount won, and the price the customer pays. */
  partnerDiscountPct?: string | number | null;
  partnerDiscountAmount?: string | number;
  discountSource?: 'coupon' | 'partner' | null;
  afterPhotos?: string[];
  partnerId: string | null;
  partnerName: string | null;
  status: GroomingBookingStatus | WalkingBookingStatus;
  scheduledAt: string | null;
  slotDurationMinutes: number | null;
  addressId: string;
  addressLine: string;
  address?: Address;
  channel: BookingChannel;
  notes: string | null;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  cancelledAt: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroomingBooking extends Booking {
  type: 'grooming';
  status: GroomingBookingStatus;
  packageId: string;
  packageName: string;
  packagePrice: number;
  addOns: BookingAddOn[];
}

export interface WalkingBooking extends Booking {
  type: 'walking';
  status: WalkingBookingStatus;
  durationMinutes: number;
  walkSessionId: string | null;
}

export interface BookingAddOn {
  addOnId: string;
  name: string;
  price: number;
}

export interface BookingStatusHistory {
  id: string;
  bookingId: string;
  status: string;
  note: string | null;
  changedBy: string;
  changedAt: string;
}

export interface CreateGroomingBookingInput {
  petId: string;
  packageId: string;
  addOnIds?: string[];
  scheduledAt: string;
  addressId: string;
  notes?: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  channel?: BookingChannel;
  /** "any" (default) lets any eligible partner claim it; "specific" reserves it for requestedPartnerId. */
  assignmentMode?: AssignmentMode;
  requestedPartnerId?: string;
}

export interface CreateWalkingBookingInput {
  petId: string;
  durationMinutes: 30 | 45 | 60;
  scheduleNow: boolean;
  scheduledAt?: string;
  addressId: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  assignmentMode?: AssignmentMode;
  requestedPartnerId?: string;
}
