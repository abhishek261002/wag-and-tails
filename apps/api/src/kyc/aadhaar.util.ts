import { createHmac } from 'crypto';

export function hashIdentity(subjectId: string): string {
  const pepper = process.env['AADHAAR_HASH_PEPPER'];
  if (!pepper || pepper.length < 16) {
    throw new Error('AADHAAR_HASH_PEPPER must be set (16+ characters) before identities can be processed');
  }
  return createHmac('sha256', pepper).update(`id:${subjectId}`).digest('hex');
}

export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const pepper = process.env['AADHAAR_HASH_PEPPER'] ?? 'ip';
  return createHmac('sha256', pepper).update(`ip:${ip}`).digest('hex').slice(0, 32);
}

export function maskAadhaar(last4: string | null | undefined): string {
  return last4 ? `XXXX XXXX ${last4}` : 'Not available';
}

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'sri', 'kumari', 'late']);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !TITLES.has(t));
}

// True when the entered name and the Aadhaar name are plausibly the same person: tokens may be
// reordered, and a single-letter initial matches any token starting with it.
export function namesMatch(entered: string, aadhaarName: string): boolean {
  const a = nameTokens(entered);
  const b = nameTokens(aadhaarName);
  if (!a.length || !b.length) return false;
  const used = new Set<number>();
  let hits = 0;
  for (const ta of a) {
    const idx = b.findIndex((tb, i) => !used.has(i) && (ta === tb || (ta.length === 1 && tb.startsWith(ta)) || (tb.length === 1 && ta.startsWith(tb))));
    if (idx >= 0) {
      used.add(idx);
      hits++;
    }
  }
  return hits / Math.max(a.length, b.length) >= 0.5;
}

export function ageFromDob(dob: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}
