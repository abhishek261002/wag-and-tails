import { normalizeCity } from '../common/city.js';

// Pure helpers for turning a map provider's address data into what the app stores. No I/O, so they are
// unit-tested on their own and the provider can change without touching the rules.

export interface AddressComponent {
  types: string[];
  long_name: string;
  short_name?: string;
}

export interface PlaceDetails {
  lat: number;
  lng: number;
  formattedAddress: string;
  /** Street / road name, when the provider knows one. */
  street: string | null;
  /** Neighbourhood or locality inside the city ("Civil Lines"). */
  area: string | null;
  city: string;
  state: string;
  pincode: string | null;
  /** The operating city this point falls in ("Kanpur", "Lucknow", "Delhi"), or null when outside all of them. */
  serviceCity: string | null;
  serviceable: boolean;
}

export interface PlaceSuggestion {
  placeId: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

// Rough bounding box of India (incl. islands). Cheap sanity check that stops zero/garbage coordinates and
// the (0,0) "null island" some clients send; it is not a border test.
export const INDIA_BOUNDS = { minLat: 6.0, maxLat: 37.6, minLng: 68.0, maxLng: 97.5 } as const;

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng
  );
}

/** Cities the business operates in. Override with SERVICE_CITIES="Kanpur,Lucknow,Delhi". */
export function serviceCities(): string[] {
  const raw = process.env['SERVICE_CITIES'] ?? 'Kanpur,Lucknow,Delhi';
  return raw.split(',').map((c) => c.trim()).filter(Boolean);
}

export function isServiceCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const n = normalizeCity(city);
  return serviceCities().some((c) => normalizeCity(c) === n);
}

const byType = (components: AddressComponent[], type: string) => components.find((c) => c.types.includes(type))?.long_name ?? null;

/**
 * Which operating city an address belongs to. Providers name the same place differently ("Kanpur Nagar" is
 * the district, "New Delhi" is a locality of the Delhi state), so the name is looked for in the locality,
 * district and state fields rather than compared for equality.
 */
export function resolveServiceCity(components: AddressComponent[]): string | null {
  const haystack = ['locality', 'administrative_area_level_3', 'administrative_area_level_2', 'administrative_area_level_1']
    .map((t) => byType(components, t))
    .filter((v): v is string => !!v)
    .map((v) => v.toLowerCase());
  for (const city of serviceCities()) {
    const needle = normalizeCity(city);
    if (haystack.some((h) => h === needle || h.includes(needle))) return city;
  }
  return null;
}

const unique = (parts: (string | null)[]) => parts.filter((p, i, a): p is string => !!p && a.indexOf(p) === i);

export function parsePlace(
  lat: number,
  lng: number,
  formattedAddress: string,
  components: AddressComponent[]
): PlaceDetails {
  const serviceCity = resolveServiceCity(components);
  const city =
    serviceCity ??
    byType(components, 'locality') ??
    byType(components, 'administrative_area_level_3') ??
    byType(components, 'administrative_area_level_2') ??
    '';
  const pin = byType(components, 'postal_code');
  return {
    lat,
    lng,
    formattedAddress,
    street: byType(components, 'street_address') ?? byType(components, 'route'),
    area: unique([byType(components, 'sublocality'), byType(components, 'neighborhood')])[0] ?? null,
    city,
    state: byType(components, 'administrative_area_level_1') ?? '',
    pincode: pin && /^\d{6}$/.test(pin) ? pin : null,
    serviceCity,
    serviceable: serviceCity !== null,
  };
}

/** "Baba Kharak Singh Marg, Connaught Place" — a starting point for the address's area line. */
export function suggestedAreaLine(p: Pick<PlaceDetails, 'street' | 'area'>): string {
  return unique([p.street, p.area]).join(', ');
}
