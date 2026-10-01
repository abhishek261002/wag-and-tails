// Chat message ordering, shared by the customer and partner apps. The API returns messages newest-first and
// realtime events arrive one at a time, so the screens keep one list that is merged and ordered here: oldest at
// the top, newest at the bottom.

export interface OrderableMessage {
  id: string;
  sentAt: string | number | Date;
}

const time = (m: OrderableMessage) => {
  const t = new Date(m.sentAt).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Oldest first. Messages sent in the same instant keep a stable order by id. */
export function orderMessages<T extends OrderableMessage>(messages: readonly T[]): T[] {
  return [...messages].sort((a, b) => time(a) - time(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Adds `incoming` to `existing`: a message already present (same id) is replaced by the newer copy, and the
 * result is ordered oldest first. Safe to call with the same page twice (polling) or with a single realtime event.
 */
export function mergeMessages<T extends OrderableMessage>(existing: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return orderMessages([...byId.values()]);
}
