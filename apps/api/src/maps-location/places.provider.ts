import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { parsePlace, type AddressComponent, type PlaceDetails, type PlaceSuggestion } from './places.js';

export interface PlacesProvider {
  readonly name: string;
  autocomplete(query: string, bias?: { lat: number; lng: number }): Promise<PlaceSuggestion[]>;
  reverse(lat: number, lng: number): Promise<PlaceDetails | null>;
  geocode(address: string): Promise<PlaceDetails | null>;
}

// Manual AbortController: AbortSignal.timeout() clashes with the mixed DOM/undici typings in this repo.
async function timedFetch(url: string, init: Record<string, unknown> = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal } as never);
  } finally {
    clearTimeout(timer);
  }
}

interface CacheEntry<T> { at: number; value: T }
class TtlCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  constructor(private ttlMs: number, private max = 500) {}
  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.ttlMs) { this.map.delete(key); return undefined; }
    return hit.value;
  }
  set(key: string, value: T) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { at: Date.now(), value });
  }
}

type OlaResult = {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  address_components?: AddressComponent[];
};

/**
 * Ola Maps (Krutrim) places API. Response shapes were checked against the live API: autocomplete returns
 * `predictions` with coordinates, geocode returns `geocodingResults`, reverse-geocode returns `results`.
 */
export class OlaPlacesProvider implements PlacesProvider {
  readonly name = 'ola';
  private readonly logger = new Logger('OlaPlacesProvider');
  private autocompleteCache = new TtlCache<PlaceSuggestion[]>(5 * 60_000);
  private reverseCache = new TtlCache<PlaceDetails | null>(60 * 60_000);
  private geocodeCache = new TtlCache<PlaceDetails | null>(60 * 60_000);

  constructor(private apiKey: string, private baseUrl = process.env['OLA_MAPS_BASE_URL'] ?? 'https://api.olamaps.io') {}

  private async get(path: string, params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams({ ...params, api_key: this.apiKey }).toString();
    let res: Response;
    try {
      res = await timedFetch(`${this.baseUrl}${path}?${qs}`, { headers: { 'X-Request-Id': crypto.randomUUID() } });
    } catch (err) {
      this.logger.warn(`Ola ${path} unreachable: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Address search is temporarily unavailable. Please try again.');
    }
    if (!res.ok) {
      // Never log the URL: it carries the API key.
      this.logger.warn(`Ola ${path} -> HTTP ${res.status}`);
      throw new ServiceUnavailableException('Address search is temporarily unavailable. Please try again.');
    }
    return res.json().catch(() => ({}));
  }

  private toDetails(r: OlaResult | undefined, fallback?: { lat: number; lng: number }): PlaceDetails | null {
    if (!r) return null;
    const lat = r.geometry?.location?.lat ?? fallback?.lat;
    const lng = r.geometry?.location?.lng ?? fallback?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return parsePlace(lat, lng, r.formatted_address ?? '', r.address_components ?? []);
  }

  async autocomplete(query: string, bias?: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
    const key = `${query.toLowerCase()}|${bias ? `${bias.lat.toFixed(1)},${bias.lng.toFixed(1)}` : ''}`;
    const cached = this.autocompleteCache.get(key);
    if (cached) return cached;
    const params: Record<string, string> = { input: query };
    if (bias) params['location'] = `${bias.lat},${bias.lng}`;
    const body = await this.get('/places/v1/autocomplete', params);
    const out: PlaceSuggestion[] = [];
    for (const p of (body.predictions ?? []) as any[]) {
      const loc = p?.geometry?.location;
      if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') continue;
      out.push({
        placeId: String(p.place_id ?? ''),
        title: String(p.structured_formatting?.main_text ?? p.description ?? ''),
        subtitle: String(p.structured_formatting?.secondary_text ?? ''),
        lat: loc.lat,
        lng: loc.lng,
      });
      if (out.length >= 8) break;
    }
    this.autocompleteCache.set(key, out);
    return out;
  }

  async reverse(lat: number, lng: number): Promise<PlaceDetails | null> {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = this.reverseCache.get(key);
    if (cached !== undefined) return cached;
    const body = await this.get('/places/v1/reverse-geocode', { latlng: `${lat},${lng}` });
    // The first result is often a shop or landmark at that spot; its address components are still the
    // area's, and the coordinates we keep are the ones the user chose, not the landmark's.
    const details = this.toDetails((body.results ?? [])[0], { lat, lng });
    const result = details ? { ...details, lat, lng } : null;
    this.reverseCache.set(key, result);
    return result;
  }

  async geocode(address: string): Promise<PlaceDetails | null> {
    const key = address.toLowerCase();
    const cached = this.geocodeCache.get(key);
    if (cached !== undefined) return cached;
    const body = await this.get('/places/v1/geocode', { address });
    const details = this.toDetails((body.geocodingResults ?? [])[0]);
    this.geocodeCache.set(key, details);
    return details;
  }
}

/** The configured provider, or null when maps are not set up (callers turn that into a clear 503). */
export function createPlacesProvider(logger: Logger): PlacesProvider | null {
  const name = (process.env['MAPS_PROVIDER'] ?? 'ola').toLowerCase();
  if (name !== 'ola') {
    logger.error(`MAPS_PROVIDER=${name} is not supported for address search; set MAPS_PROVIDER=ola`);
    return null;
  }
  const key = process.env['OLA_MAPS_API_KEY'];
  if (!key) {
    logger.error('OLA_MAPS_API_KEY is not set: address search and geocoding are unavailable');
    return null;
  }
  return new OlaPlacesProvider(key);
}
