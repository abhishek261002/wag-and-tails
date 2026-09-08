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

  // Mirrors Uber's flow, shared by both grooming and walking bookings:
  // assigned/accepted -> on the way -> arrived -> (OTP the customer shows)
  // -> in progress -> completed.
  markOnTheWay(bookingId: string): Promise<void> {
    return this.client.patch(`/partner/jobs/${bookingId}/on-the-way`, {});
  }

  markArrived(bookingId: string): Promise<void> {
    return this.client.patch(`/partner/jobs/${bookingId}/arrived`, {});
  }

  verifyStartOtp(bookingId: string, otp: string): Promise<void> {
    return this.client.patch(`/partner/jobs/${bookingId}/verify-start`, { otp });
  }

  completeJob(
    bookingId: string,
    data: { checklistItems: string[]; beforePhotos: string[]; afterPhotos: string[] }
  ): Promise<void> {
    return this.client.patch(`/partner/jobs/${bookingId}/complete`, data);
  }

  // Walking-specific — a walk request sits at `searching_partner`, not
  // `needs_partner`, so it can't go through claimJob (that's grooming's
  // /jobs/:id/claim, which only matches needs_partner). Once accepted here,
  // the shared on-the-way/arrived/verify-start/complete endpoints above
  // handle both job types identically (verifyStartOtp starts the
  // WalkSession server-side, completeJob ends it).
  acceptWalkRequest(bookingId: string): Promise<void> {
    return this.client.post(`/walking/${bookingId}/accept`);
  }

  rejectWalkRequest(_bookingId: string): Promise<void> {
    return Promise.resolve();
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
