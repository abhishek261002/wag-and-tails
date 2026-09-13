import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { wagApi } from '../lib/api';

const BROADCAST_INTERVAL_MS = 8000;

// While a job is on-the-way/arrived/in-progress, periodically push this
// partner's GPS position to the backend, which broadcasts it to the
// booking's realtime room so the customer's tracking screen updates live.
// `active` should be false once the job leaves that window (e.g. completed)
// so we stop draining battery/location permission usage.
//
// Also returns the last-known position so the partner's own screen can
// render it on a LiveMapView — a single watcher shared between the
// broadcast and the local map display, rather than two.
export function useJobLocationBroadcast(active: boolean) {
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number; heading?: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: BROADCAST_INTERVAL_MS,
          distanceInterval: 15,
        },
        (pos) => {
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading ?? undefined });
          wagApi.partner
            .updateLocation(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.heading ?? undefined
            )
            .catch(() => {});
        }
      );
    })();

    return () => {
      cancelled = true;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [active]);

  return position;
}
