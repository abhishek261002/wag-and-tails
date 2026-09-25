export interface ProviderPayment {
  providerPaymentId: string;
  signature?: string;
}

interface PayInput {
  /** Provider public key from the API; null means the development mock provider. */
  keyId: string | null;
  providerOrderId: string;
  amountInr: number;
  description: string;
  prefill?: { email?: string; contact?: string; name?: string };
}

/**
 * Opens the payment provider's checkout. With the development mock provider there is nothing to open, so a
 * fake reference is returned and the API (also on the mock) accepts it. With Razorpay, the native SDK
 * (`react-native-razorpay`, needs a development/production build, not Expo Go) collects the payment and
 * returns the signature the server verifies.
 */
export async function payWithProvider(input: PayInput): Promise<ProviderPayment> {
  if (!input.keyId) {
    return { providerPaymentId: `mock_pay_${Date.now()}`, signature: 'mock' };
  }
  let Razorpay: any;
  try {
    Razorpay = require('react-native-razorpay').default;
  } catch {
    throw new Error('Online payment is not available in this build. Please update the app.');
  }
  const res = await Razorpay.open({
    key: input.keyId,
    amount: Math.round(input.amountInr * 100),
    currency: 'INR',
    order_id: input.providerOrderId,
    name: 'Wag & Tails',
    description: input.description,
    prefill: input.prefill,
    theme: { color: '#5B3A29' },
  });
  return { providerPaymentId: res.razorpay_payment_id, signature: res.razorpay_signature };
}
