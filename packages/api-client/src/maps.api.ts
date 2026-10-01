import type { ApiClient } from './client.js';

export interface PlaceSuggestion {
  placeId: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export interface PlaceDetails {
  lat: number;
  lng: number;
  formattedAddress: string;
  street: string | null;
  area: string | null;
  /** "Baba Kharak Singh Marg, Connaught Place": a starting point for the address's area line. */
  areaLine: string;
  city: string;
  state: string;
  pincode: string | null;
  /** The operating city this point falls in, or null when outside all of them. */
  serviceCity: string | null;
  serviceable: boolean;
}

export class MapsApi {
  constructor(private client: ApiClient) {}

  autocomplete(q: string, bias?: { lat: number; lng: number }): Promise<{ suggestions: PlaceSuggestion[] }> {
    return this.client.get('/maps/autocomplete', { params: { q, ...(bias ?? {}) } });
  }

  reverse(lat: number, lng: number): Promise<{ place: PlaceDetails | null }> {
    return this.client.get('/maps/reverse', { params: { lat, lng } });
  }

  serviceCities(): Promise<{ cities: string[] }> {
    return this.client.get('/maps/service-cities');
  }
}
