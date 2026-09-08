import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { wagApi } from '../lib/api';

const BROADCAST_INTERVAL_MS = 8000;

// While a job is on-the-way/arrived/in-progress, periodically push this
// partner's GPS position to the backend, which broadcasts it to the
// booking's realtime room so the customer's tracking screen updates live.
// `active` should be false once the job leaves that window (e.g. completed)
// so we stop draining battery/location permission usage.
export function useJobLocationBroadcast(active: boolean) {
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

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
        (position) => {
          wagApi.partner
            .updateLocation(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.heading ?? undefined
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
}
