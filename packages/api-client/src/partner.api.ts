import type { ApiClient } from './client.js';
import type { Partner, PartnerJobCard, PartnerEarnings, PayoutRequest, DuesStatus, DuesPayOrder } from '@wag/shared-types';

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
    data: { otp: string; checklistItems: string[]; afterPhotos: string[] }
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

  // Uploads one job photo (fetch-to-blob so it works on native and web) and returns its stored URL.
  async uploadJobPhoto(bookingId: string, file: { uri: string; name: string; type: string }): Promise<string> {
    const blob = await (await fetch(file.uri)).blob();
    const formData = new FormData();
    formData.append('file', blob, file.name);
    formData.append('entity', 'booking');
    formData.append('entityId', bookingId);
    const uploaded = await this.client.post<{ url: string; id: string }>('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return uploaded.url;
  }

  // Commission dues: what the partner owes the company, and paying it.
  getDues(): Promise<DuesStatus> {
    return this.client.get('/partner/dues');
  }

  createDuesOrder(amount?: number): Promise<DuesPayOrder> {
    return this.client.post('/partner/dues/pay-order', amount === undefined ? {} : { amount });
  }

  confirmDuesPayment(data: { commissionPaymentId: string; providerPaymentId: string; signature?: string }): Promise<DuesStatus> {
    return this.client.post('/partner/dues/pay-confirm', data);
  }

  // Pay-after-service: confirm the customer paid the partner directly. Required before completing the job.
  collectPayment(bookingId: string, method: 'cash' | 'upi'): Promise<{ collected: true; amount: number; method: string }> {
    return this.client.post(`/partner/jobs/${bookingId}/collect-payment`, { method });
  }

  // Decline a job a customer reserved for you specifically.
  rejectJob(bookingId: string): Promise<{ rejected: true }> {
    return this.client.post(`/partner/jobs/${bookingId}/reject`);
  }

  // Attaches already-uploaded photos as the job's before-photos. Required before verifyStartOtp.
  addBeforePhotos(bookingId: string, urls: string[]): Promise<{ beforePhotos: string[] }> {
    return this.client.post(`/partner/jobs/${bookingId}/before-photos`, { urls });
  }

  // KYC profile photo, uploaded right after sign-up (once the account —
  // and so a userId to attach the upload to — actually exists). Same
  // fetch-to-blob recipe as PetsApi.uploadAvatar / MessagingApi.uploadAttachment,
  // works on both native and web.
  async uploadProfilePhoto(userId: string, file: { uri: string; name: string; type: string }): Promise<{ url: string }> {
    const blob = await (await fetch(file.uri)).blob();

    const formData = new FormData();
    formData.append('file', blob, file.name);
    formData.append('entity', 'partner');
    formData.append('entityId', userId);

    const uploaded = await this.client.post<{ url: string; id: string }>(
      '/files/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    await this.updateProfile({ photoUrl: uploaded.url });
    return uploaded;
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
