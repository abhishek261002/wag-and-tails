import { Injectable } from '@nestjs/common';
import { NavigationTracker, straightLineRoute, type LatLng, type RouteInfo } from '../common/navigation.js';
import { RoutingService } from './routing.service.js';

const REFRESH_AFTER_MS = 60_000;
const MAX_ENTRIES = 2000;

export interface Eta {
  seconds: number;
  meters: number;
  /** True when this came from a straight-line estimate rather than a real route. */
  approximate: boolean;
}

/**
 * ETA for a partner who is heading to a booking. Called on every location update (every few seconds), so it
 * must never wait for the network: it answers from the last known route (matching the partner's position onto
 * it) and refreshes that route in the background when it is old or the partner has left it.
 */
@Injectable()
export class TrackingService {
  private live = new Map<string, { route: RouteInfo; at: number }>();
  private refreshing = new Set<string>();

  constructor(private routing: RoutingService) {}

  etaFor(bookingId: string, pos: LatLng, dest: LatLng): Eta {
    const entry = this.live.get(bookingId);
    let stale = !entry || Date.now() - entry.at > REFRESH_AFTER_MS;

    if (entry && !entry.route.approximate) {
      // Off route after a single fix: the cached route is no use any more.
      const st = new NavigationTracker(entry.route, { offRouteFixes: 1 }).update(pos);
      if (!st.offRoute) {
        if (stale) this.refresh(bookingId, pos, dest);
        return { seconds: st.remainingS, meters: st.remainingM, approximate: false };
      }
      stale = true;
    }
    if (stale) this.refresh(bookingId, pos, dest);
    const est = straightLineRoute(pos, dest);
    return { seconds: est.durationSeconds, meters: est.distanceMeters, approximate: true };
  }

  forget(bookingId: string) {
    this.live.delete(bookingId);
  }

  private refresh(bookingId: string, pos: LatLng, dest: LatLng) {
    if (this.refreshing.has(bookingId)) return;
    this.refreshing.add(bookingId);
    this.routing
      .getRoute(pos, dest)
      .then((route) => {
        if (this.live.size >= MAX_ENTRIES) this.live.delete(this.live.keys().next().value as string);
        // An estimate is remembered too, so a provider outage does not trigger a refresh on every update.
        this.live.set(bookingId, { route, at: Date.now() });
      })
      .catch(() => {})
      .finally(() => this.refreshing.delete(bookingId));
  }
}
