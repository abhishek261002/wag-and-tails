// Case/whitespace-insensitive city match, since "Kanpur", "kanpur " and
// "KANPUR" should all be treated as the same operating city regardless of
// how a partner or an address record happens to have it capitalized.
export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}
