// Which times a customer can book. One set of rules for the apps (what to show) and the API (what to accept), so
// they cannot disagree. Pure functions of an explicit `now`, so they are easy to test and a screen that stays open
// can re-run them as time passes.
//
// Times are the device's local wall-clock (IST for customers in India). The API compares instants, so it does not
// depend on either side's timezone.

/** A slot must start at least this many minutes from now (time for a partner to accept and travel). */
export const MIN_LEAD_MINUTES = 30;
/** How many days ahead, counting today, the app offers. */
export const BOOKING_DAYS_AHEAD = 14;
/** The API accepts bookings up to this far ahead (more than the app offers, so a slow client is not refused). */
export const MAX_BOOKING_HORIZON_DAYS = 30;
/** The API forgives a client clock running this many minutes behind the server. */
export const CLOCK_SKEW_TOLERANCE_MINUTES = 5;

/** Hourly grooming slots, 8:00 to 17:00. */
export const GROOMING_SLOT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;
/** Walk slots: early morning and evening. */
export const WALKING_SLOT_HOURS = [6, 7, 8, 9, 10, 16, 17, 18, 19, 20] as const;

export interface Slot {
  /** "8:00 AM" */
  label: string;
  hour: number;
  /** The slot's start as an instant. */
  at: Date;
}

const MS_MINUTE = 60_000;
const MS_DAY = 86_400_000;

export function startOfLocalDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Local calendar day `n` days after `from`'s day, at 00:00 (DST-safe: it moves the date, not the clock). */
export function addLocalDays(from: Date, n: number): Date {
  const r = startOfLocalDay(from);
  r.setDate(r.getDate() + n);
  return r;
}

export function slotLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}

/** The slot for `hour` on `day`, as an instant. */
export function slotAt(day: Date, hour: number): Date {
  const d = startOfLocalDay(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * The slots on `day` that can still be booked at `now`: those starting at least `leadMinutes` from now.
 * A day in the past has none.
 */
export function availableSlots(
  now: Date,
  day: Date,
  hours: readonly number[] = GROOMING_SLOT_HOURS,
  leadMinutes: number = MIN_LEAD_MINUTES
): Slot[] {
  const earliest = now.getTime() + leadMinutes * MS_MINUTE;
  return hours
    .map((hour) => ({ hour, label: slotLabel(hour), at: slotAt(day, hour) }))
    .filter((s) => s.at.getTime() >= earliest);
}

export interface BookableDay {
  day: Date;
  slots: Slot[];
  /** False when nothing is left on that day (e.g. today, late in the evening). */
  available: boolean;
}

/** `count` days starting today, each with its remaining slots. Days with no slot left are kept but flagged. */
export function bookableDays(
  now: Date,
  count: number = BOOKING_DAYS_AHEAD,
  hours: readonly number[] = GROOMING_SLOT_HOURS,
  leadMinutes: number = MIN_LEAD_MINUTES
): BookableDay[] {
  return Array.from({ length: count }, (_, i) => {
    const day = addLocalDays(now, i);
    const slots = availableSlots(now, day, hours, leadMinutes);
    return { day, slots, available: slots.length > 0 };
  });
}

/** The first day that still has a slot, or null if none does. */
export function firstAvailableDay(days: readonly BookableDay[]): BookableDay | null {
  return days.find((d) => d.available) ?? null;
}

export type ScheduleProblem = 'invalid' | 'past' | 'too_far';

/**
 * Server-side check of a requested time. Returns null when it is acceptable, or why not. The lead time is
 * relaxed by CLOCK_SKEW_TOLERANCE_MINUTES so a phone whose clock is a few minutes slow is not refused for a slot
 * the app itself offered.
 */
export function scheduleProblem(at: Date, now: Date = new Date()): ScheduleProblem | null {
  const t = at.getTime();
  if (!Number.isFinite(t)) return 'invalid';
  const earliest = now.getTime() + (MIN_LEAD_MINUTES - CLOCK_SKEW_TOLERANCE_MINUTES) * MS_MINUTE;
  if (t < earliest) return 'past';
  if (t > now.getTime() + MAX_BOOKING_HORIZON_DAYS * MS_DAY) return 'too_far';
  return null;
}

export const SCHEDULE_PROBLEM_MESSAGE: Record<ScheduleProblem, string> = {
  invalid: 'Please choose a valid date and time.',
  past: 'That time is too soon or has already passed. Please pick a later slot.',
  too_far: 'Bookings can be made up to 30 days ahead. Please pick an earlier date.',
};
