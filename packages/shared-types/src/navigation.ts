// Turn-by-turn navigation maths shared by the API (ETA for the customer) and the partner app (guidance).
// Pure TypeScript with no dependencies, so it can be unit-tested with simulated drives without a device.

import type { LatLng } from './location.js';
export type { LatLng };

export type Maneuver =
  | 'depart' | 'straight' | 'slight-left' | 'turn-left' | 'sharp-left'
  | 'slight-right' | 'turn-right' | 'sharp-right' | 'uturn' | 'roundabout' | 'merge' | 'arrive' | 'other';

export interface RouteStep {
  instruction: string;
  maneuver: Maneuver;
  /** Road name, may be empty. */
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  /** Where the maneuver of this step happens (its start). */
  location: LatLng;
  /** Index into RouteInfo.geometry where this step begins. */
  geometryStart: number;
}

export interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  geometry: LatLng[];
  steps: RouteStep[];
  /** True when this is a straight-line estimate because no routing provider answered. */
  approximate: boolean;
  provider: string;
}

// ── Geometry ──────────────────────────────────────────────────────────────────

const R_EARTH_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Compass bearing from a to b, 0-360 (0 = north). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Decodes a Google/OSRM-style encoded polyline. */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const out: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0, shift = 0, byte: number;
      do {
        if (index >= encoded.length) throw new Error('Malformed polyline');
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta; else lng += delta;
    }
    out.push({ lat: lat / factor, lng: lng / factor });
  }
  return out;
}

export function encodePolyline(points: LatLng[], precision = 5): string {
  const factor = 10 ** precision;
  let prevLat = 0, prevLng = 0, out = '';
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) { s += String.fromCharCode((0x20 | (n & 0x1f)) + 63); n >>= 5; }
    return s + String.fromCharCode(n + 63);
  };
  for (const p of points) {
    const la = Math.round(p.lat * factor), ln = Math.round(p.lng * factor);
    out += enc(la - prevLat) + enc(ln - prevLng);
    prevLat = la; prevLng = ln;
  }
  return out;
}

/** Cumulative distance in meters at each vertex of the geometry (first is 0). */
export function cumulativeDistances(geometry: LatLng[]): number[] {
  const cum = [0];
  for (let i = 1; i < geometry.length; i++) cum.push(cum[i - 1]! + haversineM(geometry[i - 1]!, geometry[i]!));
  return cum;
}

export interface Projection {
  /** Index of the segment start vertex. */
  index: number;
  /** Meters travelled along the route to the snapped point. */
  distanceAlongM: number;
  /** Straight distance from the fix to the snapped point. */
  offRouteM: number;
  snapped: LatLng;
}

// Local equirectangular projection around the point: exact enough for segments of a few hundred meters.
function projectOnSegment(p: LatLng, a: LatLng, b: LatLng): { t: number; point: LatLng; dist: number } {
  const cosLat = Math.cos(rad(p.lat));
  const ax = (a.lng - p.lng) * cosLat, ay = a.lat - p.lat;
  const bx = (b.lng - p.lng) * cosLat, by = b.lat - p.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const point = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  return { t, point, dist: haversineM(p, point) };
}

/** Snaps a position onto the route, searching only segments [from, to] (inclusive). */
export function projectOnRoute(geometry: LatLng[], cum: number[], p: LatLng, from = 0, to = geometry.length - 2): Projection {
  let best: Projection | null = null;
  const start = Math.max(0, from);
  const end = Math.min(geometry.length - 2, to);
  for (let i = start; i <= end; i++) {
    const s = projectOnSegment(p, geometry[i]!, geometry[i + 1]!);
    if (!best || s.dist < best.offRouteM) {
      best = { index: i, distanceAlongM: cum[i]! + haversineM(geometry[i]!, s.point), offRouteM: s.dist, snapped: s.point };
    }
  }
  if (!best) {
    const g = geometry[0] ?? p;
    return { index: 0, distanceAlongM: 0, offRouteM: haversineM(p, g), snapped: g };
  }
  return best;
}

// ── Tracker ───────────────────────────────────────────────────────────────────

export interface Fix extends LatLng {
  heading?: number | null;
  /** Meters, from the device; larger means less trustworthy. */
  accuracy?: number | null;
  /** ms since epoch. */
  t?: number;
}

export interface NavState {
  snapped: LatLng;
  /** Bearing of the route at the snapped point, for orienting the camera. */
  routeBearing: number;
  progressM: number;
  remainingM: number;
  remainingS: number;
  currentStepIndex: number;
  nextStepIndex: number | null;
  /** Distance to where the next instruction applies. */
  distanceToNextM: number;
  offRoute: boolean;
  arrived: boolean;
  /** Voice prompts that became due with this fix, each spoken once. */
  announcements: string[];
}

export interface TrackerOptions {
  /** A fix farther than this from the route counts as off it (before accuracy is considered). */
  offRouteM?: number;
  /** Consecutive off-route fixes needed before declaring the driver off route (ignores GPS spikes). */
  offRouteFixes?: number;
  arriveM?: number;
  /** Announce the next maneuver when it is this close. */
  announceM?: number;
}

const DEFAULTS: Required<TrackerOptions> = { offRouteM: 40, offRouteFixes: 3, arriveM: 40, announceM: 250 };

const PHRASE: Record<Maneuver, string> = {
  depart: 'Head out', straight: 'Continue straight', 'slight-left': 'Bear left', 'turn-left': 'Turn left', 'sharp-left': 'Turn sharp left',
  'slight-right': 'Bear right', 'turn-right': 'Turn right', 'sharp-right': 'Turn sharp right', uturn: 'Make a U-turn',
  roundabout: 'Enter the roundabout', merge: 'Merge', arrive: 'You have arrived', other: 'Continue',
};

export function spokenDistance(m: number): string {
  if (m < 30) return '';
  if (m < 1000) return `in ${Math.round(m / 10) * 10} meters`;
  return `in ${(m / 1000).toFixed(1)} kilometers`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function formatDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

/**
 * Follows a driver along a route. Feed it GPS fixes in order; it snaps them to the road, tracks which
 * instruction is current, estimates what is left, detects going off route and yields voice prompts.
 * Progress only moves forward, so overlapping streets (out-and-back roads) cannot snap the driver backwards.
 */
export class NavigationTracker {
  private cum: number[];
  private lastIndex = 0;
  private lastProgress = 0;
  private offCount = 0;
  private spoken = new Set<string>();
  private opts: Required<TrackerOptions>;

  constructor(public readonly route: RouteInfo, opts: TrackerOptions = {}) {
    if (route.geometry.length < 2) throw new Error('A route needs at least two points');
    this.opts = { ...DEFAULTS, ...opts };
    this.cum = cumulativeDistances(route.geometry);
  }

  get totalM() {
    return this.cum[this.cum.length - 1]!;
  }

  update(fix: Fix): NavState {
    const g = this.route.geometry;
    // Look ahead of where we last were first; only fall back to the whole route if that fails to match.
    let proj = projectOnRoute(g, this.cum, fix, this.lastIndex - 2, this.lastIndex + 60);
    const tolerance = Math.max(this.opts.offRouteM, (fix.accuracy ?? 0) * 1.5);
    if (proj.offRouteM > tolerance) {
      const whole = projectOnRoute(g, this.cum, fix);
      if (whole.offRouteM < proj.offRouteM) proj = whole;
    }

    const offNow = proj.offRouteM > tolerance;
    this.offCount = offNow ? this.offCount + 1 : 0;
    const offRoute = this.offCount >= this.opts.offRouteFixes;

    if (!offNow) {
      // Never let a noisy fix move us backwards along the route by more than GPS jitter.
      if (proj.distanceAlongM >= this.lastProgress - 15) {
        this.lastIndex = proj.index;
        this.lastProgress = Math.max(this.lastProgress, proj.distanceAlongM);
      }
    }
    const progressM = this.lastProgress;
    const remainingM = Math.max(0, this.totalM - progressM);

    // Current step = the last step that started at or before our progress.
    const steps = this.route.steps;
    let currentStepIndex = 0;
    for (let i = 0; i < steps.length; i++) {
      if (this.cum[steps[i]!.geometryStart]! <= progressM + 1) currentStepIndex = i;
      else break;
    }
    const nextStepIndex = currentStepIndex + 1 < steps.length ? currentStepIndex + 1 : null;
    const nextStart = nextStepIndex != null ? this.cum[steps[nextStepIndex]!.geometryStart]! : this.totalM;
    const distanceToNextM = Math.max(0, nextStart - progressM);

    // Time left: the rest of this step pro rata plus every later step in full.
    let remainingS = 0;
    steps.forEach((s, i) => {
      if (i < currentStepIndex) return;
      if (i === currentStepIndex) {
        const stepLen = Math.max(1, (nextStepIndex != null ? this.cum[steps[nextStepIndex]!.geometryStart]! : this.totalM) - this.cum[s.geometryStart]!);
        remainingS += s.durationSeconds * Math.min(1, distanceToNextM / stepLen);
      } else remainingS += s.durationSeconds;
    });
    if (steps.length === 0 && this.route.distanceMeters > 0) remainingS = this.route.durationSeconds * (remainingM / this.route.distanceMeters);

    const arrived = remainingM <= Math.max(this.opts.arriveM, (fix.accuracy ?? 0) > 30 ? 60 : 0);

    const announcements: string[] = [];
    if (nextStepIndex != null && !arrived) {
      const next = steps[nextStepIndex]!;
      const keyNear = `near:${nextStepIndex}`;
      const keyNow = `now:${nextStepIndex}`;
      const road = next.name ? ` onto ${next.name}` : '';
      const isArrival = next.maneuver === 'arrive';
      if (distanceToNextM <= this.opts.announceM && distanceToNextM > 60 && !this.spoken.has(keyNear) && !this.spoken.has(keyNow)) {
        this.spoken.add(keyNear);
        announcements.push(
          isArrival
            ? `Your destination is ${spokenDistance(distanceToNextM)}`.replace(/ $/, '')
            : `${spokenDistance(distanceToNextM)}, ${PHRASE[next.maneuver].toLowerCase()}${road}`.replace(/^, /, '')
        );
      }
      if (distanceToNextM <= 60 && !this.spoken.has(keyNow)) {
        this.spoken.add(keyNow);
        // The arrival itself is announced once, below.
        if (!isArrival) announcements.push(`${PHRASE[next.maneuver]}${road}`);
      }
    }
    if (arrived && !this.spoken.has('arrive')) {
      this.spoken.add('arrive');
      announcements.push('You have arrived at your destination');
    }

    const nextPoint = g[Math.min(g.length - 1, proj.index + 1)]!;
    const routeBearing = bearingDeg(g[proj.index]!, nextPoint);
    return { snapped: proj.snapped, routeBearing, progressM, remainingM, remainingS, currentStepIndex, nextStepIndex, distanceToNextM, offRoute, arrived, announcements };
  }
}

/** Straight-line stand-in used when no routing provider answers. Speed is a rough city driving average. */
export function straightLineRoute(from: LatLng, to: LatLng, avgSpeedKmh = 22): RouteInfo {
  const d = haversineM(from, to) * 1.3; // roads are longer than the crow flies
  return {
    distanceMeters: d,
    durationSeconds: (d / 1000 / avgSpeedKmh) * 3600,
    geometry: [from, to],
    steps: [
      { instruction: 'Head towards the destination', maneuver: 'depart', name: '', distanceMeters: d, durationSeconds: (d / 1000 / avgSpeedKmh) * 3600, location: from, geometryStart: 0 },
    ],
    approximate: true,
    provider: 'estimate',
  };
}

/** The part of the route still ahead of the driver, starting at their snapped position (for drawing). */
export function routeAhead(geometry: LatLng[], cum: number[], progressM: number, snapped: LatLng): LatLng[] {
  let i = 0;
  while (i < cum.length - 1 && cum[i + 1]! <= progressM) i++;
  return [snapped, ...geometry.slice(i + 1)];
}

/** What GET /bookings/:id/route returns. `steps` is empty for customers. */
export type RouteResponse =
  | { available: false; destination: LatLng & { label: string } }
  | {
      available: true;
      destination: LatLng & { label: string };
      from: LatLng;
      approximate: boolean;
      provider: string;
      distanceMeters: number;
      durationSeconds: number;
      arrivalAt: string;
      /** Encoded polyline (precision 5); decode with decodePolyline. */
      polyline: string;
      steps: RouteStep[];
    };

/** Rebuilds a RouteInfo from the API response so it can be fed to NavigationTracker. */
export function routeFromResponse(r: Extract<RouteResponse, { available: true }>): RouteInfo {
  return {
    distanceMeters: r.distanceMeters,
    durationSeconds: r.durationSeconds,
    geometry: decodePolyline(r.polyline),
    steps: r.steps,
    approximate: r.approximate,
    provider: r.provider,
  };
}
