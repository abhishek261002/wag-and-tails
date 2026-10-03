// Which browser origins may call the API in production. CORS_ORIGINS is a comma-separated list of exact origins
// (scheme + host + optional port, no path). An entry may contain one "*" to match a single hostname label, for
// Vercel preview deployments, e.g. "https://wag-admin-*.vercel.app". Matching is exact: a prefix such as
// "https://wag-admin.vercel.app.evil.com" is not accepted.

export type OriginMatcher = (origin: string) => boolean;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseAllowedOrigins(raw: string | undefined): OriginMatcher[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((entry) => {
      if (!entry.includes('*')) return (origin: string) => origin === entry;
      // "*" stands for one hostname label: letters, digits and dashes only (no dots, so no other domains).
      const re = new RegExp('^' + entry.split('*').map(escape).join('[a-z0-9-]+') + '$', 'i');
      return (origin: string) => re.test(origin);
    });
}

export function isAllowedOrigin(origin: string, matchers: OriginMatcher[]): boolean {
  const o = origin.replace(/\/+$/, '');
  return matchers.some((m) => m(o));
}
