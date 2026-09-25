import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { wagApi } from '../lib/api';

const BROADCAST_INTERVAL_MS = 8000;
const NAV_BROADCAST_INTERVAL_MS = 4000;

export interface JobPosition {
  lat: number;
  lng: number;
  heading?: number;
  accuracy?: number;
  speed?: number;
  /** ms since epoch of the fix */
  t: number;
}

// While a job is on-the-way/arrived/in-progress, periodically push this
// partner's GPS position to the backend, which broadcasts it to the
// booking's realtime room so the customer's tracking screen updates live.
// `active` should be false once the job leaves that window (e.g. completed)
// so we stop draining battery/location permission usage.
//
// Also returns the last-known position so the partner's own screen can
// render it on a LiveMapView — a single watcher shared between the
// broadcast and the local map display, rather than two.
//
// `navigation: true` is for the turn-by-turn screen: fixes arrive about once a second (for smooth guidance)
// while the server still only hears from us every few seconds.
export function useJobLocationBroadcast(active: boolean, opts: { navigation?: boolean } = {}) {
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef(0);
  const [position, setPosition] = useState<JobPosition | null>(null);
  const navigation = !!opts.navigation;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const every = navigation ? NAV_BROADCAST_INTERVAL_MS : BROADCAST_INTERVAL_MS;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      const sub = await Location.watchPositionAsync(
        navigation
          ? { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 }
          : { accuracy: Location.Accuracy.High, timeInterval: BROADCAST_INTERVAL_MS, distanceInterval: 15 },
        (pos) => {
          const c = pos.coords;
          setPosition({
            lat: c.latitude,
            lng: c.longitude,
            heading: c.heading != null && c.heading >= 0 ? c.heading : undefined,
            accuracy: c.accuracy ?? undefined,
            speed: c.speed != null && c.speed >= 0 ? c.speed : undefined,
            t: pos.timestamp,
          });
          const now = Date.now();
          if (now - lastSentRef.current >= every - 200) {
            lastSentRef.current = now;
            wagApi.partner.updateLocation(c.latitude, c.longitude, c.heading != null && c.heading >= 0 ? c.heading : undefined).catch(() => {});
          }
        }
      );
      // The screen may have unmounted while the permission prompt or watcher set-up was pending.
      if (cancelled) sub.remove();
      else watcherRef.current = sub;
    })();

    return () => {
      cancelled = true;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [active, navigation]);

  return position;
}
