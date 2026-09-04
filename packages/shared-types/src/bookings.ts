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

export interface Booking {
  id: string;
  type: BookingType;
  customerId: string;
  petId: string;
  petName: string;
  petBreed: string;
  petSize: string;
  petCareNotes: string | null;
  partnerId: string | null;
  partnerName: string | null;
  status: GroomingBookingStatus | WalkingBookingStatus;
  scheduledAt: string | null;
  slotDurationMinutes: number | null;
  addressId: string;
  addressLine: string;
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
}

export interface CreateWalkingBookingInput {
  petId: string;
  durationMinutes: 30 | 45 | 60;
  scheduleNow: boolean;
  scheduledAt?: string;
  addressId: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
}
