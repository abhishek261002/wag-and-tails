// v1/local-development escape hatch for the job-matching + realtime
// dispatch flow. Defaults to `true` — the full, production-equivalent,
// geofenced behavior — unless explicitly disabled. Nothing changes for a
// deployed environment unless ENABLE_LOCATION_FILTERING=false is set
// there too, so this is safe to leave wired in permanently and toggle
// per-environment via .env rather than a code change.
export function isLocationFilteringEnabled(): boolean {
  return process.env['ENABLE_LOCATION_FILTERING'] !== 'false';
}
