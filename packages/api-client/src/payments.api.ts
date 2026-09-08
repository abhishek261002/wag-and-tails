import type { ApiClient } from './client.js';

export interface PaymentOrder {
  payment: { id: string; status: string; amount: number };
  providerOrderId: string;
}

export class PaymentsApi {
  constructor(private client: ApiClient) {}

  createOrder(bookingId: string, amount: number): Promise<PaymentOrder> {
    return this.client.post('/payments/orders', { bookingId, amount });
  }

  confirm(paymentId: string, method: string): Promise<{ id: string; status: string }> {
    return this.client.patch(`/payments/${paymentId}/confirm`, { method });
  }
}
