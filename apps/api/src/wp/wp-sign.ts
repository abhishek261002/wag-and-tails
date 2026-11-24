import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Signing for the WordPress plugin's Connector (wp-plugin/includes/connector.php).
// signature = HMAC-SHA256(secret, `${ts}\n${nonce}\n${METHOD}\n${route}\n${body}`)
// where route is the REST route ("/wt/v1/connector/config") plus "?" and the query with keys sorted,
// encoded the way PHP's http_build_query does it (spaces as "+").

export const WP_SKEW_SECONDS = 300;

const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, '+');

export function canonicalRoute(route: string, query?: Record<string, string | number | undefined>): string {
  const keys = Object.keys(query ?? {}).filter((k) => query![k] !== undefined && query![k] !== '').sort();
  if (keys.length === 0) return route;
  return route + '?' + keys.map((k) => `${enc(k)}=${enc(String(query![k]))}`).join('&');
}

export function wpSignature(secret: string, ts: string, nonce: string, method: string, route: string, body: string): string {
  return createHmac('sha256', secret).update(`${ts}\n${nonce}\n${method.toUpperCase()}\n${route}\n${body}`).digest('hex');
}

export function signedHeaders(secret: string, method: string, route: string, body: string, now = Date.now()) {
  const ts = String(Math.floor(now / 1000));
  const nonce = randomBytes(16).toString('hex');
  return {
    'X-WT-Timestamp': ts,
    'X-WT-Nonce': nonce,
    'X-WT-Signature': wpSignature(secret, ts, nonce, method, route, body),
  };
}

/** Checks a message the plugin sent us. `path` is the URL path (with query) it was posted to. */
export function verifyWpSignature(
  secret: string,
  headers: { ts?: string; nonce?: string; sig?: string },
  method: string,
  path: string,
  body: string,
  now = Date.now()
): boolean {
  const { ts, nonce, sig } = headers;
  if (!secret || !ts || !nonce || !sig || !/^\d+$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(ts)) > WP_SKEW_SECONDS) return false;
  const exp = Buffer.from(wpSignature(secret, ts, nonce, method, path, body), 'utf8');
  const got = Buffer.from(sig, 'utf8');
  return exp.length === got.length && timingSafeEqual(exp, got);
}
