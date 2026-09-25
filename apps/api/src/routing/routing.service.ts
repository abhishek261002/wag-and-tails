import { Injectable, Logger } from '@nestjs/common';
import { haversineM, straightLineRoute, type LatLng, type RouteInfo } from '../common/navigation.js';
import { OlaProvider, OsrmProvider, type RoutingProvider } from './providers.js';

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
// Two positions closer than this share a route (about 11 m at 4 decimals).
const key = (a: LatLng, b: LatLng, provider: string) => `${provider}|${a.lat.toFixed(4)},${a.lng.toFixed(4)}|${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly provider: RoutingProvider | null;
  private readonly cache = new Map<string, { at: number; route: RouteInfo }>();
  private readonly inflight = new Map<string, Promise<RouteInfo>>();
  // After a provider failure, skip it for a short while instead of making every request wait for a timeout.
  private downUntil = 0;

  constructor() {
    const name = (process.env['ROUTING_PROVIDER'] ?? '').toLowerCase() || (process.env['OLA_MAPS_API_KEY'] ? 'ola' : 'osrm');
    if (name === 'mock') this.provider = null;
    else if (name === 'ola') {
      const k = process.env['OLA_MAPS_API_KEY'];
      if (!k) {
        this.logger.warn('ROUTING_PROVIDER=ola but OLA_MAPS_API_KEY is empty; falling back to OSRM');
        this.provider = new OsrmProvider();
      } else this.provider = new OlaProvider(k);
    } else this.provider = new OsrmProvider();
    if (process.env['NODE_ENV'] === 'production' && this.provider?.name === 'osrm' && !process.env['OSRM_URL']) {
      // The public OSRM demo server has no uptime promise and a fair-use policy.
      this.logger.warn('Using the public OSRM demo server in production; set OLA_MAPS_API_KEY or OSRM_URL');
    }
  }

  get providerName() {
    return this.provider?.name ?? 'estimate';
  }

  /**
   * A drivable route from -> to. Never throws: if the provider is down or slow the caller gets a flagged
   * straight-line estimate, so the screen can always show something and an ETA.
   */
  async getRoute(from: LatLng, to: LatLng): Promise<RouteInfo> {
    if (!this.provider || Date.now() < this.downUntil) return straightLineRoute(from, to);
    const k = key(from, to, this.provider.name);
    const hit = this.cache.get(k);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.route;

    // Concurrent callers for the same trip share one provider call.
    let p = this.inflight.get(k);
    if (!p) {
      p = this.provider.route(from, to).finally(() => this.inflight.delete(k));
      this.inflight.set(k, p);
    }
    try {
      const route = await p;
      if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
      this.cache.set(k, { at: Date.now(), route });
      return route;
    } catch (err) {
      this.logger.warn(`routing failed (${this.provider.name}): ${(err as Error).message}`);
      this.downUntil = Date.now() + 15_000;
      return straightLineRoute(from, to);
    }
  }

  /** Cheap ETA with no network: road-ish distance at city speed. Used while a real route is loading. */
  estimateSeconds(from: LatLng, to: LatLng): number {
    return Math.round(straightLineRoute(from, to).durationSeconds);
  }

  distanceM(a: LatLng, b: LatLng) {
    return haversineM(a, b);
  }
}
