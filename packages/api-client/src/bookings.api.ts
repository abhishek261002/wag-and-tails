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
