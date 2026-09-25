import type { ApiClient } from './client.js';

export interface PaymentOrder {
  payment: { id: string; status: string; amount: number };
  providerOrderId: string;
  /** Provider public key for the checkout SDK; null with the development mock provider. */
  keyId: string | null;
}

export class PaymentsApi {
  constructor(private client: ApiClient) {}

  // The amount is always taken from the booking on the server.
  createOrder(bookingId: string): Promise<PaymentOrder> {
    return this.client.post('/payments/orders', { bookingId });
  }

  confirm(
    paymentId: string,
    data: { method: 'upi' | 'card' | 'wallet'; providerPaymentId?: string; signature?: string }
  ): Promise<{ id: string; status: string }> {
    return this.client.patch(`/payments/${paymentId}/confirm`, data);
  }

  // Pay-after-service: nothing is charged; the booking is confirmed and offered to partners.
  payAfterService(bookingId: string): Promise<{ id: string; status: string }> {
    return this.client.post(`/payments/bookings/${bookingId}/pay-after-service`);
  }
}
