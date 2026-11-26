import { TransformRequestManager } from '@maplibre/maplibre-react-native';
import { getOlaMapsApiKey } from './mapsConfig';

// Ola Maps wants the api_key on EVERY request, but its style file only lists plain source, sprite and font URLs
// (api.olamaps.io/.../planet.json, /sprite, /fonts/...). Only the style request itself carried the key, so the
// tile requests came back 401 and the map stayed blank (address picker) or broke (tracking, navigation).
// This adds the key to every Ola request that does not already have one. Call it once after configureMaps().
let applied: string | null = null;

export function applyOlaRequestKey(): void {
  const key = getOlaMapsApiKey();
  if (!key || key === applied) return;
  TransformRequestManager.addUrlSearchParam({
    id: 'ola-api-key',
    match: '^(?!.*api_key=).*olamaps\\.io',
    name: 'api_key',
    value: key,
  });
  applied = key;
}
