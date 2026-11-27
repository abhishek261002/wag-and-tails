// What a customer may read in a booking's timeline. Partner and desk notes are written for the team: they can name
// people and give private reasons ("Released by the partner: <name>: ...", "Stopped: <why>"), so the customer gets a
// neutral line instead.
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/^(Released by the partner:|Partner removed:)/, 'We are finding you another partner.'],
  [/^Stopped:/, 'The visit was stopped. Our team will contact you.'],
  [/^Completed at the desk by /, 'Completed by our team.'],
];

export function customerHistoryNote<T extends string | null | undefined>(note: T): T | string {
  if (!note) return note;
  const hit = REPLACEMENTS.find(([re]) => re.test(note));
  return hit ? hit[1] : note;
}

export function customerHistory<T extends { note?: string | null }>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r, note: customerHistoryNote(r.note) }));
}
