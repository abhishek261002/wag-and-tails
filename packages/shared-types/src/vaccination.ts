// A pet's vaccination state at a glance ("Vaccinated", "Booster due"), computed the same way for the Pets list, the
// pet page and the API. Pure: pass `now` explicitly.

export type VaccinationState = 'up_to_date' | 'due_soon' | 'overdue' | 'not_vaccinated_yet' | 'no_records';

export interface VaccinationRecord {
  vaccineName: string;
  administeredDate: string | Date;
  expiryDate?: string | Date | null;
}

export interface VaccinationSummary {
  state: VaccinationState;
  /** Short label for a chip. */
  label: string;
  /** The soonest date a booster is (or was) due; null when there is nothing to track. */
  nextDueDate: string | null;
  /** Name of the vaccine that is due next, when there is one. */
  nextDueVaccine: string | null;
}

/** How far ahead a booster counts as "due soon". */
export const BOOSTER_WARNING_DAYS = 30;
/** Used when a record has no expiry date: vaccines are assumed to last a year. */
export const DEFAULT_VACCINE_VALIDITY_DAYS = 365;

const DAY = 86_400_000;

function dueDate(r: VaccinationRecord): Date {
  if (r.expiryDate) return new Date(r.expiryDate);
  return new Date(new Date(r.administeredDate).getTime() + DEFAULT_VACCINE_VALIDITY_DAYS * DAY);
}

/**
 * Only the most recent shot of each vaccine counts (an old, expired rabies record does not make a pet "overdue"
 * once a newer one exists). The state is then the worst of those: overdue, else due soon, else up to date.
 */
export function summarizeVaccinations(
  records: readonly VaccinationRecord[],
  vaccinationStatus: string | null | undefined,
  now: Date = new Date()
): VaccinationSummary {
  const valid = records.filter((r) => Number.isFinite(new Date(r.administeredDate).getTime()));
  if (valid.length === 0) {
    return vaccinationStatus === 'not_vaccinated_yet'
      ? { state: 'not_vaccinated_yet', label: 'Not vaccinated yet', nextDueDate: null, nextDueVaccine: null }
      : { state: 'no_records', label: 'No vaccine records', nextDueDate: null, nextDueVaccine: null };
  }

  const latest = new Map<string, VaccinationRecord>();
  for (const r of valid) {
    const key = r.vaccineName.trim().toLowerCase();
    const cur = latest.get(key);
    if (!cur || new Date(r.administeredDate).getTime() > new Date(cur.administeredDate).getTime()) latest.set(key, r);
  }

  let soonest: { at: Date; name: string } | null = null;
  for (const r of latest.values()) {
    const at = dueDate(r);
    if (!Number.isFinite(at.getTime())) continue;
    if (!soonest || at.getTime() < soonest.at.getTime()) soonest = { at, name: r.vaccineName };
  }
  if (!soonest) return { state: 'no_records', label: 'No vaccine records', nextDueDate: null, nextDueVaccine: null };

  const t = now.getTime();
  const iso = soonest.at.toISOString().slice(0, 10);
  if (soonest.at.getTime() < t) return { state: 'overdue', label: 'Vaccine overdue', nextDueDate: iso, nextDueVaccine: soonest.name };
  if (soonest.at.getTime() - t <= BOOSTER_WARNING_DAYS * DAY) return { state: 'due_soon', label: 'Booster due', nextDueDate: iso, nextDueVaccine: soonest.name };
  return { state: 'up_to_date', label: 'Vaccinated', nextDueDate: iso, nextDueVaccine: soonest.name };
}
