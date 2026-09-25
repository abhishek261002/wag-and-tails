import type { ApiClient } from './client.js';
import type {
  GroomingBooking,
  WalkingBooking,
  GroomingPackage,
  AddOn,
  WalkPricing,
  CreateGroomingBookingInput,
  CreateWalkingBookingInput,
  BookingStatusHistory,
  PartnerOption,
  RouteResponse,
} from '@wag/shared-types';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BookingFilters {
  type?: 'grooming' | 'walking';
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export class BookingsApi {
  constructor(private client: ApiClient) {}

  // Partner cards for checkout: everyone eligible, past partners flagged and listed first.
  getPartnerOptions(params: { type: 'grooming' | 'walking'; petId: string; addressId: string }): Promise<PartnerOption[]> {
    return this.client.get('/bookings/partner-options', { params });
  }

  // After a chosen partner declined or did not answer: pick again (or fall back to "anyone").
  redispatch(bookingId: string, data: { assignmentMode: 'any' | 'specific'; requestedPartnerId?: string }): Promise<GroomingBooking | WalkingBooking> {
    return this.client.post(`/bookings/${bookingId}/redispatch`, data);
  }

  // The road route from the partner to the booking address. Partners get turn steps; customers get the line and ETA.
  // Partners pass their live position so the route starts exactly where they are.
  getRoute(bookingId: string, from?: { lat: number; lng: number }): Promise<RouteResponse> {
    return this.client.get(`/bookings/${bookingId}/route`, { params: from ? { fromLat: from.lat, fromLng: from.lng } : undefined });
  }

  // Catalogue
  getPackages(): Promise<GroomingPackage[]> {
    return this.client.get('/grooming/packages');
  }

  getAddOns(): Promise<AddOn[]> {
    return this.client.get('/grooming/add-ons');
  }

  getWalkPricing(): Promise<WalkPricing[]> {
    return this.client.get('/walking/pricing');
  }

  getAvailableSlots(packageId: string, date: string, addressId: string): Promise<string[]> {
    return this.client.get('/grooming/slots', { params: { packageId, date, addressId } });
  }

  // Booking creation
  createGroomingBooking(data: CreateGroomingBookingInput): Promise<GroomingBooking> {
    return this.client.post('/bookings/grooming', data);
  }

  createWalkingBooking(data: CreateWalkingBookingInput): Promise<WalkingBooking> {
    return this.client.post('/bookings/walking', data);
  }

  // Booking management
  list(filters?: BookingFilters): Promise<PaginatedResponse<GroomingBooking | WalkingBooking>> {
    return this.client.get('/bookings', { params: filters });
  }

  get(bookingId: string): Promise<GroomingBooking | WalkingBooking> {
    return this.client.get(`/bookings/${bookingId}`);
  }

  getHistory(bookingId: string): Promise<BookingStatusHistory[]> {
    return this.client.get(`/bookings/${bookingId}/history`);
  }

  reschedule(bookingId: string, scheduledAt: string, reason?: string): Promise<GroomingBooking> {
    return this.client.patch(`/bookings/${bookingId}/reschedule`, { scheduledAt, reason });
  }

  cancel(bookingId: string, reason?: string): Promise<void> {
    return this.client.patch(`/bookings/${bookingId}/cancel`, { reason });
  }

  applyCoupon(code: string, service: string, orderValue: number): Promise<{ discount: number; newTotal: number }> {
    return this.client.post('/coupons/apply', { couponCode: code, service, orderValue });
  }
}
