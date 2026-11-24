// Shared helpers for the end-to-end audit suites (apps/api/test/e2e). LOCAL ONLY: the API on :3001, the dev database
// container `wag_postgres_dev`, and the staging WordPress in infra/wp-staging. Never run against live systems.
import { createHmac, randomBytes } from 'crypto';
import { execFileSync, execFile } from 'child_process';
import * as path from 'path';

export const API = process.env.E2E_API ?? 'http://127.0.0.1:3001/api/v1';
export const SITE = process.env.E2E_SITE ?? 'http://localhost:8090/wp-json';
export const SECRET = process.env.E2E_SECRET ?? 'local-dev-connector-secret-change-me';
export const COMPOSE = path.resolve(__dirname, '../../../../infra/wp-staging/docker-compose.yml');
export const TEST_PHONE = '9123400001'; // website customer used by these suites

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── database and WordPress ─────────────────────────────────────────────────────────

export function sql(q: string): string {
  return execFileSync('docker', ['exec', 'wag_postgres_dev', 'psql', '-U', 'postgres', '-d', 'wagandtails', '-tAc', q], { encoding: 'utf8' }).trim();
}
export function wp(php: string): string {
  return execFileSync('docker', ['compose', '-f', COMPOSE, 'exec', '-T', 'cli', 'wp', 'eval', php], { encoding: 'utf8' }).trim();
}
export function wpJson<T = any>(php: string): T {
  return JSON.parse(wp(`echo wp_json_encode( ${php} );`));
}
/** Run the website's queued "something changed" messages now (Action Scheduler). */
export function runWpQueue() {
  try { execFileSync('docker', ['compose', '-f', COMPOSE, 'exec', '-T', 'cli', 'wp', 'action-scheduler', 'run', '--hooks=wt_conn_push', '--batch-size=50'], { stdio: 'ignore' }); } catch { /* nothing due */ }
}
export function runWpQueueAsync(): Promise<void> {
  return new Promise((resolve) => execFile('docker', ['compose', '-f', COMPOSE, 'exec', '-T', 'cli', 'wp', 'action-scheduler', 'run', '--hooks=wt_conn_push', '--batch-size=50'], () => resolve()));
}

// ── HTTP ─────────────────────────────────────────────────────────────────────────────

export interface Res<T = any> { s: number; b: T; headers: Headers }

export async function http<T = any>(method: string, url: string, opts: { token?: string | null; body?: unknown; headers?: Record<string, string>; raw?: string } = {}): Promise<Res<T>> {
  const hasBody = opts.body !== undefined || opts.raw !== undefined;
  const r = await fetch(url, {
    method,
    headers: { ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}), ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers ?? {}) },
    body: opts.raw !== undefined ? opts.raw : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text();
  let b: any = text;
  try { b = JSON.parse(text); } catch { /* not json */ }
  return { s: r.status, b, headers: r.headers };
}
export const api = <T = any>(token: string | null | undefined, method: string, p: string, body?: unknown) => http<T>(method, API + p, { token, body });

export async function login(email: string, password: string): Promise<string> {
  const r = await api(null, 'POST', '/auth/login', { email, password });
  const t = r.b.accessToken ?? r.b.tokens?.accessToken;
  if (!t) throw new Error(`login failed for ${email}: ${JSON.stringify(r.b)}`);
  return t;
}
export async function otpLogin(phone: string): Promise<string> {
  const req = await api(null, 'POST', '/auth/otp/request', { phone });
  const v = await api(null, 'POST', '/auth/otp/verify', { phone, otp: req.b.otp });
  const t = v.b.accessToken ?? v.b.tokens?.accessToken;
  if (!t) throw new Error(`otp login failed for ${phone}: ${JSON.stringify(v.b)}`);
  return t;
}

// ── signing (same format as the plugin's Connector: ts \n nonce \n METHOD \n route \n body) ──

export function canonical(route: string, query?: Record<string, string | number>): string {
  const keys = Object.keys(query ?? {}).sort();
  if (!keys.length) return route;
  const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');
  return route + '?' + keys.map((k) => `${enc(k)}=${enc(String(query![k]))}`).join('&');
}
export function signature(method: string, route: string, body: string, ts: string, nonce: string, secret = SECRET) {
  return createHmac('sha256', secret).update(`${ts}\n${nonce}\n${method}\n${route}\n${body}`).digest('hex');
}
export interface SignOpts { query?: Record<string, string | number>; body?: unknown; ts?: number; nonce?: string; secret?: string; sig?: string; method?: string; signedBody?: string }

/** A call TO the website's Connector, signed like our backend does. */
export async function signedWp<T = any>(method: string, route: string, o: SignOpts = {}): Promise<Res<T>> {
  const ts = String(o.ts ?? Math.floor(Date.now() / 1000));
  const nonce = o.nonce ?? randomBytes(12).toString('hex');
  const raw = o.body === undefined ? '' : JSON.stringify(o.body);
  const c = canonical(route, o.query);
  const sig = o.sig ?? signature(o.method ?? method, c, o.signedBody ?? raw, ts, nonce, o.secret);
  return http<T>(method, SITE + c, { raw: raw || undefined, headers: { 'X-WT-Timestamp': ts, 'X-WT-Nonce': nonce, 'X-WT-Signature': sig } });
}
/** A call TO our backend's connector endpoints, signed like the plugin does. */
export async function signedApi<T = any>(method: string, p: string, o: SignOpts = {}): Promise<Res<T>> {
  const ts = String(o.ts ?? Math.floor(Date.now() / 1000));
  const nonce = o.nonce ?? randomBytes(12).toString('hex');
  const raw = o.body === undefined ? '' : JSON.stringify(o.body);
  const route = '/api/v1/' + p;
  const sig = o.sig ?? signature(o.method ?? method, route, o.signedBody ?? raw, ts, nonce, o.secret);
  return http<T>(method, API + '/' + p, { raw: raw || undefined, headers: { 'X-WT-Timestamp': ts, 'X-WT-Nonce': nonce, 'X-WT-Signature': sig } });
}

// ── scenario helpers ─────────────────────────────────────────────────────────────────

export const istDate = (days: number) => new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export async function freeSlots(date: string, city = 'lucknow', pkg = 'pkfull'): Promise<string[]> {
  const r = await signedWp('GET', '/wt/v1/connector/slots', { query: { city, date, pkg } });
  return (r.b.slots ?? []).filter((s: any) => s.free).map((s: any) => s.start);
}

/** A website booking through the plugin's own website code (pay after service). Returns the WT reference. */
export function websiteBooking(date: string, start: string, extra: Record<string, unknown> = {}): string {
  const fields = {
    city: 'lucknow', pkg: 'pkfull', petType: 'Dog', breed: 'Golden Retriever', gender: 'Male', age: '3', ageUnit: 'years',
    aggression: 'Mild — nervous with strangers', name: 'Audit Customer', email: 'audit@example.test', phone: TEST_PHONE,
    address: 'House 7, Gomti Nagar, Lucknow', pincode: '226010', lat: 26.85, lng: 80.99, date, start, pay: 'later', ...extra,
  };
  const out = wp(`echo wp_json_encode( wt_create_web_booking( json_decode( '${JSON.stringify(fields).replace(/'/g, "\\'")}', true ) ) );`);
  const j = JSON.parse(out);
  if (!j.booking) throw new Error('website booking refused: ' + out.slice(0, 300));
  return j.booking.id;
}

export const jobByRef = (ref: string) => {
  const r = sql(`select id||'|'||status||'|'||coalesce(partner_id::text,'')||'|'||coalesce(staff_flag,'')||'|'||coalesce(wp_rev::text,'') from bookings where wp_ref='${ref}'`);
  const [id, status, partnerId, flag, rev] = r.split('|');
  return { id: id ?? '', status: status ?? '', partnerId: partnerId ?? '', flag: flag ?? '', rev: rev ?? '' };
};

export async function waitFor<T>(fn: () => T | Promise<T>, ms = 30000, step = 1200): Promise<T | undefined> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return undefined;
    runWpQueue();
    await sleep(step);
  }
}
export async function drainOutbox(ms = 40000) {
  return waitFor(() => sql(`select count(*) from wp_outbox where done_at is null and failed_at is null`) === '0', ms, 1000);
}
/** A desk action the way a person does it: if the booking changed a moment ago (409), try again. */
export async function deskAction(ref: string, body: Record<string, unknown>) {
  let r = await signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body });
  for (let i = 0; i < 6 && r.s === 409; i++) { await sleep(1500); r = await signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body }); }
  return r;
}
/** How many bookings the website holds in this exact slot (counted through the plugin's own booking list). */
export function bookedAt(city: string, date: string, start: string): number {
  return Number(wp(`echo count( array_filter( wt_rec_list( 'booking', array( 'city' => '${city}', 'date' => '${date}', 'status' => array( 'Confirmed', 'Rescheduled' ) ), 'skey ASC', 500 ), function ( $b ) { return '${start}' === $b['start']; } ) );`));
}
export const pluginBooking = async (ref: string) => (await signedWp('GET', `/wt/v1/connector/bookings/${ref}`)).b.booking;

/** Clean slate for a suite: no open linked bookings, partners in Lucknow, known employment types. */
/** Free every place the audit suites took on the staging calendar (their fillers use phones 91234000xx). */
export function cleanupAuditBookings() {
  sql(`update bookings set status='cancelled' where wp_ref is not null and status not in ('completed','cancelled')`);
  wp(`global $wpdb; $t = wt_table(); foreach ( array( 'Confirmed', 'Rescheduled', 'Pending payment' ) as $st ) { $wpdb->query( $wpdb->prepare( "UPDATE $t SET status='Cancelled', data=REPLACE(data, %s, %s) WHERE type='booking' AND status=%s AND (phone LIKE '91234000%%' OR phone='${TEST_PHONE}' OR data LIKE '%%\\"source\\":\\"App\\"%%' OR data LIKE '%%Conn Test%%')", '"status":"' . $st . '"', '"status":"Cancelled"', $st ) ); }`);
}
/** Remove cancelled test bookings of the audit phones from the website (staging only), so history lists stay short. */
export function purgeCancelledAuditBookings() {
  wp(`global $wpdb; $t = wt_table(); $wpdb->query( "DELETE FROM $t WHERE type='booking' AND status='Cancelled' AND phone LIKE '91234000%'" ); $wpdb->query( "DELETE FROM $t WHERE type='booking' AND status='Cancelled' AND data LIKE '%Conn Test%'" );`);
}
/** Reset the website's per-customer rate limits (complaints per day etc.) that repeated test runs would trip. Staging only. */
export function resetWebsiteRateLimits() {
  wp(`global $wpdb; $wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_wt\_rl\_%' OR option_name LIKE '\_transient\_timeout\_wt\_rl\_%'" ); wp_cache_flush();`);
}
export function resetWorld() {
  resetWebsiteRateLimits();
  cleanupAuditBookings();
  sql(`update partner_profiles set city='Lucknow', is_online=true, employment_type='freelancer', release_count=0 where user_id=(select id from users where phone='+919900001111')`);
  sql(`update partner_profiles set city='Lucknow', is_online=true, employment_type='team' where user_id=(select id from users where phone='+919900002222')`);
  sql(`update wp_cities set walking=true where id in ('kanpur','lucknow')`);
  // Test runs earn the test freelancer commission dues; past the limit (default 1500) a partner is paused. Start each run clean.
  sql(`delete from partner_ledger_entries where partner_id in (select id from users where phone in ('+919900001111','+919900002222'))`);
  sql(`delete from partner_discounts where note like 'audit%'`);
  // Writes that gave up in earlier runs (before a fix, or on purpose) must not colour this run's result.
  sql(`delete from wp_outbox where failed_at is not null`);
}
export const userId = (phone: string) => sql(`select id from users where phone='${phone}'`);

export const PARTNERS = {
  ritika: { email: 'ritika.sharma@wagpartner.in', phone: '+919900001111', password: 'Partner@123' },
  aman: { email: 'aman.verma@wagpartner.in', phone: '+919900002222', password: 'Partner@123' },
};
export const ADMIN = { email: 'admin@wagandtails.in', password: 'WagTails@123' };
export const STAFF = { email: 'staff@wagandtails.in', password: 'WagTails@123' };
export const APP_CUSTOMER = '+919876543210';

export async function preflight() {
  const h = await http('GET', API + '/health').catch(() => null);
  if (!h || h.s !== 200) throw new Error('The API is not running on :3001. Start it (node apps/api/dist/apps/api/src/main.js) and try again.');
  const w = await http('GET', SITE + '/wt/v1/connector/config').catch(() => null);
  if (!w || w.s !== 401) throw new Error('The staging WordPress is not answering on :8090 (docker compose -f infra/wp-staging/docker-compose.yml up -d).');
}
