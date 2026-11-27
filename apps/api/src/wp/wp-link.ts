// Pure helpers for linking plugin bookings and app jobs. No I/O, so the rules are unit-tested (wp.spec.ts).
import type { BookingChannel } from '@prisma/client';

/** "+919876543210" / "919876543210" / "9876543210" → "9876543210" (the plugin's form), or null. */
export function toPluginPhone(phone: string | null | undefined): string | null {
  const d = String(phone ?? '').replace(/\D/g, '');
  const ten = d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 11 && d.startsWith('0') ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

/** "9876543210" → "+919876543210" (how the apps store phones), or null. */
export function toAppPhone(phone: string | null | undefined): string | null {
  const ten = toPluginPhone(phone);
  return ten ? `+91${ten}` : null;
}

const IST_MS = 330 * 60_000; // India has no daylight saving

/** Plugin date "2026-11-20" + start "11:30" (India time) → the instant. Null when either is malformed. */
export function istToDate(date: string | null | undefined, start: string | null | undefined): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(start ?? ''));
  if (!d || !t) return null;
  const ms = Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!, +t[1]!, +t[2]!) - IST_MS;
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/** An instant → the plugin's India-time date and start. */
export function dateToIst(at: Date): { date: string; start: string } {
  const x = new Date(at.getTime() + IST_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${x.getUTCFullYear()}-${p(x.getUTCMonth() + 1)}-${p(x.getUTCDate())}`, start: `${p(x.getUTCHours())}:${p(x.getUTCMinutes())}` };
}

/** Midnight (India time) of the day an instant falls on, as an instant. */
function istDayStart(at: Date): number {
  const x = at.getTime() + IST_MS;
  return x - (x % 86_400_000) - IST_MS;
}

/** Where a plugin booking came from, as our booking channel. */
export function channelForSource(source: string | null | undefined): BookingChannel {
  const s = String(source ?? '').toLowerCase();
  if (s === 'app') return 'app';
  if (s === 'website' || s === '') return 'website';
  if (s.includes('whatsapp')) return 'whatsapp';
  if (s.includes('insta')) return 'instagram';
  if (s.includes('walk')) return 'walk_in';
  if (s.includes('phone') || s.includes('call')) return 'phone_call';
  return 'other';
}

/** Rules the apps follow, set in the website's admin panel (Apps and partners → Settings) and synced. */
export interface AppRules {
  offerMins: number; escalateHours: number; sameDayMins: number; dayBeforeHour: number;
  cancelHours: number; noShowMins: number; reconfirmHours: number; liveTracking: boolean;
}
export const DEFAULT_APP_RULES: AppRules = {
  offerMins: 10, escalateHours: 2, sameDayMins: 15, dayBeforeHour: 18, cancelHours: 3, noShowMins: 15, reconfirmHours: 2, liveTracking: true,
};
let rules: AppRules = { ...DEFAULT_APP_RULES };
export function setAppRules(r: Partial<AppRules> | null | undefined) {
  const n = (v: unknown, d: number, min: number, max: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : d);
  const d = DEFAULT_APP_RULES;
  rules = r
    ? {
        offerMins: n(r.offerMins, d.offerMins, 2, 120), escalateHours: n(r.escalateHours, d.escalateHours, 0.25, 24),
        sameDayMins: n(r.sameDayMins, d.sameDayMins, 5, 240), dayBeforeHour: n(r.dayBeforeHour, d.dayBeforeHour, 8, 23),
        cancelHours: n(r.cancelHours, d.cancelHours, 0, 72), noShowMins: n(r.noShowMins, d.noShowMins, 5, 60),
        reconfirmHours: n(r.reconfirmHours, d.reconfirmHours, 0.25, 24), liveTracking: r.liveTracking !== false,
      }
    : { ...d };
}
export const appRules = (): AppRules => rules;

/**
 * When the desk must be alerted if nobody has accepted the job (decision 2A):
 *  - same-day jobs: 15 minutes after booking;
 *  - next-day jobs: 2 hours after booking, but no later than 6 pm (India time) the day before;
 *    booked after that 6 pm → 15 minutes;
 *  - later jobs: 2 hours after booking.
 * Never later than 30 minutes before the start.
 */
export function escalationDeadline(bookedAt: Date, scheduledAt: Date, r: AppRules = rules): Date {
  const MIN = 60_000;
  const bookedDay = istDayStart(bookedAt);
  const jobDay = istDayStart(scheduledAt);
  const days = Math.round((jobDay - bookedDay) / 86_400_000);
  let t: number;
  const soon = r.sameDayMins * MIN;
  const normal = r.escalateHours * 60 * MIN;
  if (days <= 0) t = bookedAt.getTime() + soon;
  else if (days === 1) {
    const sixPm = bookedDay + r.dayBeforeHour * 60 * MIN;
    t = bookedAt.getTime() >= sixPm ? bookedAt.getTime() + soon : Math.min(bookedAt.getTime() + normal, sixPm);
  } else t = bookedAt.getTime() + normal;
  t = Math.min(t, scheduledAt.getTime() - 30 * MIN);
  return new Date(Math.max(t, bookedAt.getTime() + MIN));
}

export type JobStatus = 'searching' | 'offered' | 'assigned' | 'on_the_way' | 'arrived' | 'in_progress' | 'needs_staff' | 'released' | 'completed' | 'cancelled';

export const FLAG_TEXT: Record<string, string> = {
  no_partner: 'No groomer yet',
  released: 'Released by groomer',
  customer_not_available: 'Customer not available',
  stopped: 'Groomer stopped the job',
  late: 'Running late',
  reconfirm_lapsed: 'Groomer did not confirm the new time',
};

/** The job status shown on the desk card for our booking status. */
export function jobStatusFor(b: { status: string; assignmentMode?: string | null; partnerId?: string | null; staffFlag?: string | null }): JobStatus {
  switch (b.status) {
    case 'needs_partner':
    case 'searching_partner':
    case 'confirmed':
      if (b.staffFlag === 'no_partner' || b.staffFlag === 'reconfirm_lapsed') return 'needs_staff';
      return b.assignmentMode === 'specific' ? 'offered' : 'searching';
    case 'assigned':
    case 'accepted':
      return 'assigned';
    case 'partner_on_the_way':
      return 'on_the_way';
    case 'arrived':
      return 'arrived';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'refunded':
    case 'expired':
      return 'cancelled';
    default:
      return 'searching';
  }
}

/** Approximate date of birth from the plugin's "age" (+ unit). */
export function dobFromAge(age: string | number | null | undefined, unit?: string | null, now = new Date()): Date | null {
  const n = Number(String(age ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 30) return null;
  const months = /month/i.test(String(unit ?? '')) || /month/i.test(String(age ?? '')) ? n : n * 12;
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - Math.round(months));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
