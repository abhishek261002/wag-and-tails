import type { ApiClient } from './client';
import { appendFile } from './multipart.js';

// The client's website (WordPress plugin), reached through our backend: booking setup, prices, points, website
// booking history and complaints. When the website is not connected these answer { connected: false }.

export interface WebsiteCity { id: string; name: string; walking: boolean }
export interface RewardRules { enabled: boolean; bookingRate: number; orderRate: number; pointValue: number; minRedeem: number; maxPct: number; signupBonus: number }
export interface BookingConfig {
  connected: boolean;
  cities?: WebsiteCity[];
  rewards?: RewardRules | null;
  aggression?: string[];
  maxDaysAhead?: number;
  selfServiceCutoffHours?: number;
}
export interface WebsiteQuote {
  base: number; subtotal: number; coupon: string; discount: number; pointsUsed: number; ptsDiscount: number; total: number;
  points: number; mins: number; cityId: string; cityName: string;
}
export interface PointsEntry { id: string; pts: number; reason: string; created?: string; at?: string; ref?: string }
export interface WebsiteBooking {
  ref: string; status: string; date: string; slot: string; package: string; pet: string; total: number;
  payMode: string | null; source: string; groomer: string | null; bookingId: string | null;
}
export interface Complaint { id: string; booking: string; bkLabel: string; category: string; text: string; status: string; created?: string; resolution?: string }

export class WebsiteApi {
  constructor(private client: ApiClient) {}

  bookingConfig(): Promise<BookingConfig> {
    return this.client.get('/config/booking');
  }

  quote(input: { packageId: string; addressId: string; cityId?: string; couponCode?: string; usePoints?: boolean; addOnIds?: string[]; petId?: string }): Promise<WebsiteQuote> {
    return this.client.post('/grooming/quote', input);
  }

  rewards(): Promise<{ connected: boolean; points: number; ledger: PointsEntry[]; rules?: RewardRules | null }> {
    return this.client.get('/me/rewards');
  }

  websiteBookings(): Promise<{ connected: boolean; bookings: WebsiteBooking[] }> {
    return this.client.get('/me/website-bookings');
  }

  complaints(): Promise<{ connected: boolean; complaints: Complaint[]; bookings: { id: string; label: string; status: string; left: number; complaintRef: string }[]; cats: string[]; hours?: number }> {
    return this.client.get('/me/complaints');
  }

  /** Upload a photo for a complaint; send the returned url in `photos`. */
  async uploadComplaintPhoto(file: { uri: string; name: string; type: string }): Promise<string> {
    const formData = new FormData();
    await appendFile(formData, 'file', file);
    formData.append('entity', 'complaint');
    formData.append('entityId', 'app');
    const uploaded = await this.client.post<{ url: string }>('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return uploaded.url;
  }

  complain(input: { booking?: string; category: string; text: string; photos?: string[] }): Promise<{ complaint: Complaint }> {
    return this.client.post('/me/complaints', input);
  }
}
