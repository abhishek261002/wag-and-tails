import { decodePolyline, haversineM, type LatLng, type Maneuver, type RouteInfo, type RouteStep } from '../common/navigation.js';

export class RoutingError extends Error {}

export interface RoutingProvider {
  readonly name: string;
  route(from: LatLng, to: LatLng): Promise<RouteInfo>;
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

const validPoint = (p: LatLng) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** Index of the geometry vertex closest to `p`, searching from `from` on so steps stay in order. */
function nearestIndex(geometry: LatLng[], p: LatLng, from: number): number {
  let best = from, bestD = Infinity;
  for (let i = from; i < geometry.length; i++) {
    const d = haversineM(geometry[i]!, p);
    if (d < bestD) { bestD = d; best = i; }
    if (d < 1) break;
  }
  return best;
}

// ── OSRM ─────────────────────────────────────────────────────────────────────

const OSRM_MODIFIER: Record<string, Maneuver> = {
  left: 'turn-left', right: 'turn-right', 'slight left': 'slight-left', 'slight right': 'slight-right',
  'sharp left': 'sharp-left', 'sharp right': 'sharp-right', straight: 'straight', uturn: 'uturn',
};

function osrmManeuver(type: string, modifier?: string): Maneuver {
  if (type === 'depart') return 'depart';
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return 'roundabout';
  if (type === 'merge') return 'merge';
  if (modifier && OSRM_MODIFIER[modifier]) return OSRM_MODIFIER[modifier]!;
  return type === 'continue' || type === 'new name' ? 'straight' : 'other';
}

const TEXT: Record<Maneuver, string> = {
  depart: 'Head out', straight: 'Continue straight', 'slight-left': 'Bear left', 'turn-left': 'Turn left', 'sharp-left': 'Turn sharp left',
  'slight-right': 'Bear right', 'turn-right': 'Turn right', 'sharp-right': 'Turn sharp right', uturn: 'Make a U-turn',
  roundabout: 'Enter the roundabout', merge: 'Merge', arrive: 'You have arrived', other: 'Continue',
};

export const instructionFor = (m: Maneuver, name: string) => (m === 'arrive' ? TEXT[m] : `${TEXT[m]}${name ? ` onto ${name}` : ''}`);

/** Turns an OSRM /route response into our RouteInfo. Exported so it can be tested against recorded data. */
export function parseOsrm(json: any): RouteInfo {
  const r = json?.routes?.[0];
  if (json?.code !== 'Ok' || !r || typeof r.geometry !== 'string') throw new RoutingError('OSRM returned no route');
  const geometry = decodePolyline(r.geometry);
  if (geometry.length < 2) throw new RoutingError('OSRM route is empty');

  const steps: RouteStep[] = [];
  let from = 0;
  for (const leg of r.legs ?? []) {
    for (const s of leg.steps ?? []) {
      const loc = s.maneuver?.location;
      const location: LatLng = Array.isArray(loc) ? { lat: loc[1], lng: loc[0] } : geometry[from]!;
      const idx = nearestIndex(geometry, location, from);
      const maneuver = osrmManeuver(String(s.maneuver?.type ?? ''), s.maneuver?.modifier);
      const name = String(s.name ?? '');
      steps.push({
        instruction: instructionFor(maneuver, name),
        maneuver,
        name,
        distanceMeters: Number(s.distance) || 0,
        durationSeconds: Number(s.duration) || 0,
        location,
        geometryStart: idx,
      });
      from = idx;
    }
  }
  return { distanceMeters: Number(r.distance) || 0, durationSeconds: Number(r.duration) || 0, geometry, steps, approximate: false, provider: 'osrm' };
}

export class OsrmProvider implements RoutingProvider {
  readonly name = 'osrm';
  constructor(private baseUrl = process.env['OSRM_URL'] ?? 'https://router.project-osrm.org') {}

  async route(from: LatLng, to: LatLng): Promise<RouteInfo> {
    if (!validPoint(from) || !validPoint(to)) throw new RoutingError('Invalid coordinates');
    const url = `${this.baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=polyline&steps=true`;
    const res = await timedFetch(url);
    if (!res.ok) throw new RoutingError(`OSRM responded ${res.status}`);
    return parseOsrm(await res.json());
  }
}

// ── Ola Maps ─────────────────────────────────────────────────────────────────

const OLA_MANEUVER: Record<string, Maneuver> = {
  'turn-left': 'turn-left', 'turn-right': 'turn-right', 'turn-slight-left': 'slight-left', 'turn-slight-right': 'slight-right',
  'turn-sharp-left': 'sharp-left', 'turn-sharp-right': 'sharp-right', straight: 'straight', uturn: 'uturn', 'uturn-left': 'uturn',
  'uturn-right': 'uturn', merge: 'merge', 'roundabout-left': 'roundabout', 'roundabout-right': 'roundabout', 'slight-left': 'slight-left',
  'slight-right': 'slight-right', left: 'turn-left', right: 'turn-right', depart: 'depart', arrive: 'arrive',
};

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Turns an Ola Maps directions response (Google-Directions-shaped) into our RouteInfo. Parsing is defensive
 * because it could only be written from the published documentation: it needs checking against a live
 * response once an API key is available.
 */
export function parseOla(json: any): RouteInfo {
  const r = json?.routes?.[0];
  const leg = r?.legs?.[0];
  const encoded: unknown = r?.overview_polyline?.points ?? r?.overview_polyline;
  if (!r || !leg || typeof encoded !== 'string') throw new RoutingError('Ola Maps returned no route');
  let geometry = decodePolyline(encoded);
  // Some endpoints return precision-6 polylines; a wrong precision puts points far outside India.
  if (geometry.some((p) => Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) || (geometry[0] && Math.abs(geometry[0].lat) < 1 && Math.abs(geometry[0].lng) < 1)) {
    geometry = decodePolyline(encoded, 6);
  }
  if (geometry.length < 2) throw new RoutingError('Ola route is empty');

  const steps: RouteStep[] = [];
  let from = 0;
  for (const s of leg.steps ?? []) {
    const start = s.start_location ?? s.startLocation;
    const location: LatLng = start && Number.isFinite(start.lat) ? { lat: start.lat, lng: start.lng } : geometry[from]!;
    const idx = nearestIndex(geometry, location, from);
    const raw = String(s.maneuver ?? '').toLowerCase();
    const maneuver: Maneuver = OLA_MANEUVER[raw] ?? (steps.length === 0 ? 'depart' : 'other');
    const text = stripHtml(String(s.html_instructions ?? s.instructions ?? ''));
    steps.push({
      instruction: text || instructionFor(maneuver, ''),
      maneuver,
      name: '',
      distanceMeters: Number(s.distance?.value ?? s.distance) || 0,
      durationSeconds: Number(s.duration?.value ?? s.duration) || 0,
      location,
      geometryStart: idx,
    });
    from = idx;
  }
  const last = geometry[geometry.length - 1]!;
  steps.push({ instruction: 'You have arrived', maneuver: 'arrive', name: '', distanceMeters: 0, durationSeconds: 0, location: last, geometryStart: geometry.length - 1 });
  return {
    distanceMeters: Number(leg.distance?.value ?? leg.distance) || 0,
    durationSeconds: Number(leg.duration?.value ?? leg.duration) || 0,
    geometry,
    steps,
    approximate: false,
    provider: 'ola',
  };
}

export class OlaProvider implements RoutingProvider {
  readonly name = 'ola';
  constructor(private apiKey: string) {}

  async route(from: LatLng, to: LatLng): Promise<RouteInfo> {
    if (!validPoint(from) || !validPoint(to)) throw new RoutingError('Invalid coordinates');
    const q = new URLSearchParams({
      origin: `${from.lat},${from.lng}`,
      destination: `${to.lat},${to.lng}`,
      alternatives: 'false',
      steps: 'true',
      overview: 'full',
      language: 'en',
      api_key: this.apiKey,
    });
    const res = await timedFetch(`https://api.olamaps.io/routing/v1/directions?${q.toString()}`, { method: 'POST', headers: { 'X-Request-Id': `wt-${Date.now()}` } });
    if (!res.ok) throw new RoutingError(`Ola Maps responded ${res.status}`);
    return parseOla(await res.json());
  }
}
