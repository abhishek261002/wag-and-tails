import type { ApiClient } from './client.js';
import type { Partner, PartnerJobCard, PartnerEarnings, PayoutRequest, DuesStatus, DuesPayOrder } from '@wag/shared-types';
import { appendFile } from './multipart.js';

export interface ToolMedia {
  id: string;
  url: string;
  kind: 'image' | 'video';
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ToolsResponse {
  items: ToolMedia[];
  counts: { photos: number; videos: number };
  rules: { minPhotos: number; maxPhotos: number; maxVideos: number };
  /** Groomers must show their tools; walkers do not. */
  required: boolean;
  /** Enough photos to be approved (always true when not required). */
  complete: boolean;
}

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

  // Uploads one job photo (via appendFile, see multipart.ts) and returns its stored URL.
  async uploadJobPhoto(bookingId: string, file: { uri: string; name: string; type: string }): Promise<string> {
    const formData = new FormData();
    await appendFile(formData, 'file', file);
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
  /** "Release job": the partner cannot do it after all (before arriving). It is offered to everyone again. */
  releaseJob(bookingId: string, reason: string): Promise<{ released: true }> {
    return this.client.post(`/partner/jobs/${bookingId}/release`, { reason });
  }

  /** Confirm the new time after the desk or the customer moved the booking. */
  confirmNewTime(bookingId: string): Promise<{ confirmed: true }> {
    return this.client.post(`/partner/jobs/${bookingId}/confirm-time`);
  }

  /** At the door, the customer cannot be reached (after waiting); a photo at the door is the proof. */
  customerNotAvailable(bookingId: string, photoUrl: string): Promise<{ reported: true }> {
    return this.client.post(`/partner/jobs/${bookingId}/customer-not-available`, { photoUrl });
  }

  /** Stop the job (pet unsafe, cannot continue). The desk is alerted and decides. */
  stopJob(bookingId: string, reason: string): Promise<{ reported: true }> {
    return this.client.post(`/partner/jobs/${bookingId}/stop`, { reason });
  }

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
    const formData = new FormData();
    await appendFile(formData, 'file', file);
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
  /** Photos and videos of the groomer's tools. */
  tools(): Promise<ToolsResponse> {
    return this.client.get('/partner/tools');
  }

  /** Uploads a photo or video, then attaches it to the partner's tools. Sent as a Blob so it works on native and web. */
  async addToolFile(file: { uri: string; name: string }): Promise<ToolMedia> {
    const formData = new FormData();
    await appendFile(formData, 'file', file);
    formData.append('entity', 'partner_tool');
    formData.append('entityId', 'me');
    const uploaded = await this.client.post<{ url: string }>('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return this.client.post('/partner/tools', { url: uploaded.url });
  }

  /** Aadhaar number and card photos kept for verification (never returned by the server, only whether they are there). */
  aadhaarStatus(): Promise<{ done: boolean; front: boolean; back: boolean; numberSaved: boolean; last4: string | null; savedAt: string | null }> {
    return this.client.get('/partner/aadhaar');
  }

  async uploadAadhaarPhoto(side: 'front' | 'back', file: { uri: string; name: string }) {
    const formData = new FormData();
    formData.append('side', side);
    await appendFile(formData, 'file', file);
    return this.client.post<{ done: boolean; front: boolean; back: boolean }>('/partner/aadhaar/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  saveAadhaarNumber(number: string, consent: boolean) {
    return this.client.post<{ done: boolean }>('/partner/aadhaar', { number: number.replace(/\s+/g, ''), consent });
  }

  removeTool(id: string): Promise<void> {
    return this.client.delete(`/partner/tools/${id}`);
  }

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
