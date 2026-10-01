import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { wagApi } from '../lib/api';

const POLL_MS = 12_000;
const ETA_REFRESH_MS = 45_000;

// Most urgent first: the one the customer is waiting to see arrive.
const PRIORITY: Record<string, number> = {
  partner_on_the_way: 0, arrived: 1, in_progress: 2, accepted: 3, assigned: 3, needs_partner: 4, searching_partner: 4,
};

export interface LiveBookings {
  bookings: any[];
  /** booking id -> ISO time the partner is expected to arrive (only while on the way). */
  arrivalAt: Record<string, string>;
  refresh: () => Promise<void>;
}

/**
 * The customer's bookings that are happening right now (a partner is being found, is on the way, or is on the job).
 * Refreshes every 12 s while the screen is in view, so a partner accepting or setting off shows up without pulling
 * to refresh. The arrival time of a partner who is on the way is looked up from the route endpoint.
 */
export function useLiveBookings(): LiveBookings {
  const [bookings, setBookings] = useState<any[]>([]);
  const [arrivalAt, setArrivalAt] = useState<Record<string, string>>({});
  const lastEta = useRef<Record<string, number>>({});
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await wagApi.bookings.list({ scope: 'live', pageSize: 10 });
      if (!alive.current) return;
      const list = [...(res.data as any[])].sort((a, b) => (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9));
      setBookings(list);

      // ETA for anyone on the way; not re-requested more often than every 45 s.
      const onTheWay = list.filter((b) => b.status === 'partner_on_the_way');
      await Promise.all(onTheWay.map(async (b) => {
        if (Date.now() - (lastEta.current[b.id] ?? 0) < ETA_REFRESH_MS) return;
        lastEta.current[b.id] = Date.now();
        try {
          const r = await wagApi.bookings.getRoute(b.id);
          if (alive.current && r.available && r.arrivalAt) setArrivalAt((prev) => ({ ...prev, [b.id]: r.arrivalAt }));
        } catch { /* the card simply shows no arrival time */ }
      }));
    } catch {
      // Offline or signed out: keep what is shown.
    }
  }, []);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const t = setInterval(refresh, POLL_MS);
      return () => clearInterval(t);
    }, [refresh])
  );

  return { bookings, arrivalAt, refresh };
}
