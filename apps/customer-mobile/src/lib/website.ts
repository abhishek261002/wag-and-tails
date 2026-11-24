import { useEffect, useState } from 'react';
import type { BookingConfig, WebsiteCity } from '@wag/api-client';
import { wagApi } from './api';

// The client's website (WordPress) sets cities, prices, slots and points. This caches its booking setup for a few
// minutes; `connected: false` means the app runs on its own data (older flow).

let cache: { at: number; value: BookingConfig } | null = null;
let inflight: Promise<BookingConfig> | null = null;

export function loadBookingConfig(force = false): Promise<BookingConfig> {
  if (!force && cache && Date.now() - cache.at < 5 * 60_000) return Promise.resolve(cache.value);
  if (!inflight) {
    inflight = wagApi.website.bookingConfig()
      .then((value) => { cache = { at: Date.now(), value }; return value; })
      .catch(() => cache?.value ?? { connected: false })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** null while loading. */
export function useBookingConfig(): BookingConfig | null {
  const [cfg, setCfg] = useState<BookingConfig | null>(cache?.value ?? null);
  useEffect(() => {
    let alive = true;
    loadBookingConfig().then((c) => { if (alive) setCfg(c); });
    return () => { alive = false; };
  }, []);
  return cfg;
}

/** The website city with exactly this name, if any. */
export function websiteCity(cfg: BookingConfig | null, cityName?: string | null): WebsiteCity | null {
  if (!cfg?.cities || !cityName) return null;
  const n = cityName.trim().toLowerCase();
  return cfg.cities.find((c) => c.name.toLowerCase() === n || c.id === n) ?? null;
}

/** Website cities that are part of a bigger GPS city ("Mumbai" → North / South / Navi Mumbai). */
export function websiteAreasOf(cfg: BookingConfig | null, cityName?: string | null): WebsiteCity[] {
  if (!cfg?.cities || !cityName) return [];
  const words = cityName.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
  return cfg.cities.filter((c) => words.some((w) => c.name.toLowerCase().includes(w)));
}

/** Server error → message for the customer. */
export function errorMessage(err: any, fallback = 'Please try again'): string {
  return err?.response?.data?.message ?? err?.message ?? fallback;
}
export const errorCode = (err: any): string | undefined => err?.response?.data?.code;
