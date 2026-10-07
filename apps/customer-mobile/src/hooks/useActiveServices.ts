import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { wagApi } from '../lib/api';

const POLL_MS = 12_000;

/** Most urgent first: what the customer is waiting on right now. */
const PRIORITY: Record<string, number> = {
  partner_on_the_way: 0, arrived: 1, in_progress: 2, accepted: 3, assigned: 3, needs_partner: 4, searching_partner: 4, confirmed: 5,
};

/**
 * Every service the customer has that is not finished yet: ongoing (partner on the way, arrived, in progress), being
 * arranged (finding or assigning a partner) and pending (confirmed, waiting for its time). Refreshes every 12 s
 * while the screen is in view.
 */
export function useActiveServices() {
  const [services, setServices] = useState<any[]>([]);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await wagApi.bookings.list({ scope: 'upcoming', pageSize: 20 });
      if (!alive.current) return;
      const list = (res.data as any[])
        .filter((b) => b.status in PRIORITY)
        .sort((a, b) => (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9) || new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
      setServices(list);
    } catch {
      // Offline or signed out: keep what is shown.
    }
  }, []);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useFocusEffect(useCallback(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]));

  return { services, refresh };
}
