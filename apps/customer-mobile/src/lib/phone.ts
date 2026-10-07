export type PhoneResult = { ok: true; e164: string } | { ok: false; message: string };

/**
 * Turns what the customer typed into +91XXXXXXXXXX. Accepts "9876543210", "09876543210", "+91 98765 43210" and
 * "91-9876543210". Indian mobile numbers start with 6, 7, 8 or 9 and have exactly 10 digits after the country code.
 */
export function cleanPhone(input: string): PhoneResult {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 0) return { ok: false, message: 'Please enter your phone number' };
  if (digits.length !== 10) return { ok: false, message: 'Please enter a valid 10-digit mobile number' };
  if (!/^[6-9]/.test(digits)) return { ok: false, message: 'Mobile numbers start with 6, 7, 8 or 9' };
  return { ok: true, e164: `+91${digits}` };
}
