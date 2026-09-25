import { useEffect, useMemo, useRef, useState } from 'react';
import { cumulativeDistances, decodePolyline, projectOnRoute, routeAhead, type LatLng } from '@wag/shared-types';
import { wagApi } from '../lib/api';

const REFRESH_MS = 90_000;

/**
 * The road path from the partner to the customer's door, plus the partner's ETA, for the live map.
 * The route is fetched from the API and re-fetched now and then; between fetches it is trimmed to what is
 * still ahead of the partner's latest position, so the line shrinks as they approach. `etaSeconds` prefers the
 * value from the partner's location broadcasts (see PartnersService.updateLocation) over the last fetched one.
 */
export function useLiveRoute(bookingId: string | undefined, active: boolean, partner: LatLng | null, etaFromSocket: number | null) {
  const [geometry, setGeometry] = useState<LatLng[] | null>(null);
  const [etaFromRoute, setEtaFromRoute] = useState<number | null>(null);
  const hasPartner = !!partner;

  useEffect(() => {
    if (!bookingId || !active || !hasPartner) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await wagApi.bookings.getRoute(bookingId);
        if (cancelled || !r.available) return;
        // A straight-line estimate is not worth drawing as if it were a road.
        setGeometry(r.approximate ? null : decodePolyline(r.polyline));
        setEtaFromRoute(r.durationSeconds);
      } catch {
        // Keep whatever we had; the dashed straight line and the socket ETA still work.
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [bookingId, active, hasPartner]);

  const ahead = useMemo(() => {
    if (!geometry || !partner) return geometry;
    const cum = cumulativeDistances(geometry);
    const p = projectOnRoute(geometry, cum, partner);
    return routeAhead(geometry, cum, p.distanceAlongM, p.snapped);
  }, [geometry, partner?.lat, partner?.lng]);

  return { route: ahead, etaSeconds: etaFromSocket ?? etaFromRoute };
}
