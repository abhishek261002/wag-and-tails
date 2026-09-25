import { createHmac, timingSafeEqual } from 'crypto';
import { Logger, ServiceUnavailableException } from '@nestjs/common';

// Amounts cross this interface in rupees; providers convert to paise themselves.
export interface PaymentProvider {
  readonly name: string;
  /** Public key the client SDK needs to open checkout (null for the mock). */
  readonly publicKey: string | null;
  createOrder(amountInr: number, currency: string, referenceId: string): Promise<{ orderId: string }>;
  verifyPayment(paymentId: string, orderId: string, signature: string): Promise<boolean>;
  initiateRefund(paymentId: string, amountInr: number): Promise<{ refundId: string }>;
}

// Local development only: every payment "succeeds". Refused in production (see createPaymentProvider).
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly publicKey = null;
  async createOrder(_amount: number, _currency: string, referenceId: string) {
    return { orderId: `mock_order_${referenceId}_${Date.now()}` };
  }
  async verifyPayment() {
    return true;
  }
  async initiateRefund() {
    return { refundId: `mock_refund_${Date.now()}` };
  }
}

const RZP = 'https://api.razorpay.com/v1';
const paise = (inr: number) => Math.round(inr * 100);

async function timedFetch(url: string, init: Record<string, unknown>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal } as never);
  } finally {
    clearTimeout(timer);
  }
}

// Razorpay Orders / Refunds REST API. Signature check follows their documented HMAC-SHA256 of
// "<order_id>|<payment_id>". Not exercised until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set.
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private readonly logger = new Logger('RazorpayPaymentProvider');

  constructor(private keyId: string, private keySecret: string) {}
  get publicKey() {
    return this.keyId;
  }

  private auth() {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  private async call(path: string, body: Record<string, unknown>): Promise<Record<string, any>> {
    const res = await timedFetch(`${RZP}${path}`, {
      method: 'POST',
      headers: { Authorization: this.auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      this.logger.error(`Razorpay ${path} -> ${res.status} ${json?.error?.description ?? ''}`);
      throw new ServiceUnavailableException('Payment provider error. Please try again.');
    }
    return json;
  }

  async createOrder(amountInr: number, currency: string, referenceId: string) {
    const o = await this.call('/orders', { amount: paise(amountInr), currency, receipt: referenceId.slice(0, 40) });
    return { orderId: String(o['id']) };
  }

  async verifyPayment(paymentId: string, orderId: string, signature: string) {
    if (!paymentId || !orderId || !signature) return false;
    const expected = createHmac('sha256', this.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async initiateRefund(paymentId: string, amountInr: number) {
    const r = await this.call(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount: paise(amountInr) });
    return { refundId: String(r['id']) };
  }
}

export function createPaymentProvider(): PaymentProvider {
  const name = (process.env['PAYMENT_PROVIDER'] ?? 'mock').toLowerCase();
  if (name === 'razorpay') {
    const id = process.env['RAZORPAY_KEY_ID'];
    const secret = process.env['RAZORPAY_KEY_SECRET'];
    if (!id || !secret) throw new Error('PAYMENT_PROVIDER=razorpay needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    return new RazorpayPaymentProvider(id, secret);
  }
  if (process.env['NODE_ENV'] === 'production' && process.env['PAYMENT_ALLOW_MOCK'] !== 'true') {
    // The mock accepts any payment, so it must never run where real money is involved.
    throw new Error('PAYMENT_PROVIDER=mock is not allowed in production');
  }
  return new MockPaymentProvider();
}
