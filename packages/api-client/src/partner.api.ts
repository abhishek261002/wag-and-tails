import type { ApiClient } from './client.js';
import type { Partner, PartnerJobCard, PartnerEarnings, PayoutRequest } from '@wag/shared-types';

export class PartnerApi {
  constructor(private client: ApiClient) {}

  getProfile(): Promise<Partner> {
    return this.client.get('/partner/profile');
  }

  updateProfile(data: Partial<Partner>): Promise<Partner> {
    return this.client.patch('/partner/profile', data);
  }

  setOnline(online: boolean): Promise<void> {
    return this.client.patch('/partner/online', { online });
  }

  updateLocation(lat: number, lng: number, heading?: number): Promise<void> {
    return this.client.post('/partner/location', { lat, lng, heading });
  }

  getOpenJobs(): Promise<PartnerJobCard[]> {
    return this.client.get('/partner/jobs/open');
  }

  claimJob(bookingId: string): Promise<void> {
    return this.client.post(`/partner/jobs/${bookingId}/claim`);
  }

  getMyJobs(status?: string): Promise<PartnerJobCard[]> {
    return this.client.get('/partner/jobs/mine', { params: { status } });
  }

  startJob(bookingId: string): Promise<void> {
    return this.client.patch(`/partner/jobs/${bookingId}/start`);
  }

  completeJob(
    bookingId: string,
    data: { checklistItems: string[]; beforePhotos: string[]; afterPhotos: string[] }
  ): Promise<void> {
    return this.client.patch(`/partner/jobs/${bookingId}/complete`, data);
  }

  // Walking-specific
  acceptWalkRequest(bookingId: string): Promise<void> {
    return this.client.post(`/partner/walks/${bookingId}/accept`);
  }

  rejectWalkRequest(bookingId: string): Promise<void> {
    return this.client.post(`/partner/walks/${bookingId}/reject`);
  }

  startWalk(bookingId: string): Promise<void> {
    return this.client.patch(`/partner/walks/${bookingId}/start`);
  }

  endWalk(bookingId: string, data: { photos: string[] }): Promise<void> {
    return this.client.patch(`/partner/walks/${bookingId}/end`, data);
  }

  // Earnings
  getEarnings(): Promise<PartnerEarnings> {
    return this.client.get('/partner/earnings');
  }

  requestPayout(amount: number): Promise<PayoutRequest> {
    return this.client.post('/partner/payouts/request', { amount });
  }

  getPayouts(): Promise<PayoutRequest[]> {
    return this.client.get('/partner/payouts');
  }

  uploadPhoto(bookingId: string, formData: FormData): Promise<{ url: string }> {
    return this.client.post(`/partner/jobs/${bookingId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
}
