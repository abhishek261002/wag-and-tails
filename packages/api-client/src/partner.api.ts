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
    return this.client.patch(`/partner/jobs/${bookingId}/start`, {});
  }

  completeJob(
    bookingId: string,
    data: { checklistItems: string[]; beforePhotos: string[]; afterPhotos: string[] }
  ): Promise<void> {
    return this.client.patch(`/partner/jobs/${bookingId}/complete`, data);
  }

  // Walking-specific — a walk request is a booking a partner claims like any
  // other job (POST /partner/jobs/:id/claim); the walk session itself lives
  // on the walking module.
  acceptWalkRequest(bookingId: string): Promise<void> {
    return this.claimJob(bookingId);
  }

  rejectWalkRequest(_bookingId: string): Promise<void> {
    return Promise.resolve();
  }

  startWalk(bookingId: string): Promise<void> {
    return this.client.post(`/walking/${bookingId}/sessions/start`, {});
  }

  endWalk(bookingId: string, data: { photos: string[] }): Promise<void> {
    return this.client.patch(`/walking/${bookingId}/sessions/end`, data);
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

  // Availability
  getAvailability(): Promise<Array<{ day: string; startTime: string; endTime: string }>> {
    return this.client.get('/partner/availability');
  }

  upsertAvailability(
    availability: Array<{ day: string; startTime: string; endTime: string }>
  ): Promise<void> {
    return this.client.put('/partner/availability', { availability });
  }

  // Documents
  getDocuments(): Promise<Array<{ id: string; docType: string; fileUrl: string; verifiedAt: string | null }>> {
    return this.client.get('/partner/documents');
  }

  uploadDocument(docType: string, fileUrl: string): Promise<{ id: string; docType: string; fileUrl: string }> {
    return this.client.post('/partner/documents', { docType, fileUrl });
  }

  // Reviews
  getReviews(): Promise<{ reviews: Array<{ id: string; reviewerName: string; rating: number; comment: string | null; tip: number | null; createdAt: string }>; avg: number; count: number }> {
    return this.client.get('/partner/reviews');
  }
}
