import { Injectable, Logger } from '@nestjs/common';
import { canonicalRoute, signedHeaders } from './wp-sign.js';

// Talks to the WordPress plugin's Connector over signed HTTPS.
//   WP_CONNECTOR_URL     the site's REST base, e.g. https://wagandtails.in/wp-json  (local staging: http://localhost:8090/wp-json)
//   WP_CONNECTOR_SECRET  the same value as WT_CONNECTOR_SECRET in the site's wp-config.php
// When either is missing the integration is off and the apps run on their own data as before.

export class WpError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly data?: unknown) {
    super(message);
  }
}

const ROUTE_PREFIX = '/wt/v1/connector/';

@Injectable()
export class WpClientService {
  private readonly logger = new Logger(WpClientService.name);

  get enabled(): boolean {
    return !!(process.env['WP_CONNECTOR_URL'] && process.env['WP_CONNECTOR_SECRET']);
  }

  async get<T = any>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('GET', path, query);
  }

  async post<T = any>(path: string, body: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('POST', path, query, body);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, query?: Record<string, string | number | undefined>, body?: unknown): Promise<T> {
    const base = (process.env['WP_CONNECTOR_URL'] ?? '').replace(/\/+$/, '');
    const secret = process.env['WP_CONNECTOR_SECRET'] ?? '';
    if (!base || !secret) throw new WpError('The website connection is not configured.', 503, 'wp_off');

    const route = canonicalRoute(ROUTE_PREFIX + path.replace(/^\/+/, ''), query);
    const raw = body === undefined ? '' : JSON.stringify(body);
    const headers: Record<string, string> = { Accept: 'application/json', ...signedHeaders(secret, method, route, raw) };
    if (raw) headers['Content-Type'] = 'application/json';

    // The signed route and the URL must carry the query in the same order and encoding.
    const url = base + route;
    const timeoutMs = Math.max(5_000, Number(process.env['WP_CONNECTOR_TIMEOUT_MS']) || 30_000);
    let res: Response | undefined;
    // Reads are retried once on a timeout or network error (WordPress on shared hosting is sometimes slow).
    // Writes are not retried here: the Connector makes them idempotent, and the caller decides when to retry.
    for (let attempt = 1; ; attempt++) {
      try {
        // A retry needs a fresh nonce: the plugin refuses a nonce it has already seen.
        const h = attempt === 1 ? headers : { ...headers, ...signedHeaders(secret, method, route, raw) };
        res = await fetch(url, { method, headers: h, body: raw || undefined, signal: AbortSignal.timeout(timeoutMs) });
        break;
      } catch (e) {
        if (method === 'GET' && attempt < 2) continue;
        throw new WpError(`The website could not be reached (${(e as Error).name}).`, 502, 'wp_unreachable');
      }
    }
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new WpError(`The website answered with something that is not JSON (HTTP ${res.status}).`, 502, 'wp_bad_response');
    }
    if (!res.ok) {
      const msg = typeof json?.message === 'string' ? json.message : `HTTP ${res.status}`;
      if (res.status === 401) this.logger.error(`WordPress refused our signature on ${method} ${path}: ${msg}. Check WP_CONNECTOR_SECRET and the server clock.`);
      throw new WpError(msg, res.status, json?.code, json?.data);
    }
    return json as T;
  }
}
