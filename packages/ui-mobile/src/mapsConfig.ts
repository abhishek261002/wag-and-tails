// Single config point for the live-tracking map. Ola Maps (Krutrim's
// mapping platform) is a MapLibre GL-compatible vector tile provider —
// once real credentials are supplied, call configureMaps({ apiKey }) once
// at app startup and every LiveMapView instance picks it up automatically.
// Until then, getMapStyle() falls back to keyless OpenStreetMap raster
// tiles so the map is real and interactive today, not a placeholder.
export interface MapsConfig {
  apiKey: string | null;
}

let config: MapsConfig = { apiKey: null };

export function configureMaps(next: Partial<MapsConfig>) {
  config = { ...config, ...next };
}

export function getOlaMapsApiKey(): string | null {
  return config.apiKey;
}

function olaStyleUrl(apiKey: string): string {
  return `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`;
}

const OSM_FALLBACK_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
} as const;

// Returns a MapLibre GL style — either Ola's hosted style URL (real
// credentials) or an inline keyless OSM raster style (fallback).
export function getMapStyle(): string | object {
  const apiKey = getOlaMapsApiKey();
  return apiKey ? olaStyleUrl(apiKey) : OSM_FALLBACK_STYLE;
}

// react-native-maps (native) has no concept of a MapLibre style — it
// overlays raster tiles via <UrlTile>. Same fallback logic: Ola's raster
// tile endpoint once configured, OSM tiles until then.
export function getNativeTileUrlTemplate(): string {
  const apiKey = getOlaMapsApiKey();
  return apiKey
    ? `https://api.olamaps.io/tiles/raster/v1/tiles/default-light-standard/{z}/{x}/{y}.png?api_key=${apiKey}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
}
