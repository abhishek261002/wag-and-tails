import type { ApiClient } from './client.js';
import type { InsuranceRequestInput, PetInsuranceRequest, InsuranceRequestStatus } from '@wag/shared-types';

export type MyInsuranceRequest = Pick<PetInsuranceRequest, 'id' | 'petId' | 'petName' | 'planType' | 'coverAmount' | 'status' | 'createdAt'>;

export interface InsuranceList {
  data: PetInsuranceRequest[];
  total: number;
  page: number;
  pageSize: number;
  byStatus: Record<InsuranceRequestStatus, number>;
}

export class InsuranceApi {
  constructor(private client: ApiClient) {}

  /** Customer: ask for a quote for one of their pets. */
  request(data: InsuranceRequestInput): Promise<PetInsuranceRequest> {
    return this.client.post('/insurance/requests', data);
  }

  mine(): Promise<MyInsuranceRequest[]> {
    return this.client.get('/insurance/requests/mine');
  }

  /** Staff and admin: follow-up list. */
  list(params: { status?: InsuranceRequestStatus; search?: string; page?: number; pageSize?: number } = {}): Promise<InsuranceList> {
    return this.client.get('/insurance/requests', { params });
  }

  update(id: string, data: { status?: InsuranceRequestStatus; staffNote?: string | null }): Promise<PetInsuranceRequest> {
    return this.client.patch(`/insurance/requests/${id}`, data);
  }
}
