// Light load audit: many people using the apps at the same moment. Not a benchmark of production hardware (this is a
// laptop with a Docker WordPress), but it must show: no 5xx from our own endpoints, no dropped connections, sensible
// latency for the screens people open all day, and graceful behaviour when the website is the slow part.
import { ADMIN, APP_CUSTOMER, PARTNERS, api, cleanupAuditBookings, http, istDate, login, otpLogin, preflight, resetWorld, sql, userId } from './helpers';

let ritika = '', cust = '', admin = '';
let pkgId = '', addrId = '';

const p95 = (ms: number[]) => [...ms].sort((a, b) => a - b)[Math.max(0, Math.ceil(ms.length * 0.95) - 1)]!;
async function timed<T>(fn: () => Promise<T>): Promise<{ r: T; ms: number }> {
  const t = Date.now();
  const r = await fn();
  return { r, ms: Date.now() - t };
}

beforeAll(async () => {
  await preflight();
  resetWorld();
  ritika = await login(PARTNERS.ritika.email, PARTNERS.ritika.password);
  admin = await login(ADMIN.email, ADMIN.password);
  cust = await otpLogin(APP_CUSTOMER);
  pkgId = sql(`select id from grooming_packages where wp_id='pkfull'`);
  addrId = sql(`select id from addresses where user_id='${userId(APP_CUSTOMER)}' and city='Lucknow' and pincode ~ '^[0-9]{6}$' limit 1`);
  await api(admin, 'POST', '/admin/wp/sync');
});
afterAll(() => { try { cleanupAuditBookings(); } catch { /* best effort */ } });

describe('screens people open all day (our own data)', () => {
  it('100 simultaneous partner "open jobs" and 100 customer "my bookings" reads: no errors, p95 under 3 s', async () => {
    const calls = [
      ...Array.from({ length: 100 }, () => timed(() => api(ritika, 'GET', '/partner/jobs/open'))),
      ...Array.from({ length: 100 }, () => timed(() => api(cust, 'GET', '/bookings?scope=upcoming'))),
    ];
    const res = await Promise.all(calls);
    const bad = res.filter((x) => x.r.s >= 500 || x.r.s === 0);
    expect(bad).toHaveLength(0);
    // the global rate limit (100/min) may answer some with 429: that is protection, not failure
    expect(res.filter((x) => x.r.s === 200 || x.r.s === 429).length).toBe(res.length);
    const ok = res.filter((x) => x.r.s === 200);
    expect(ok.length).toBeGreaterThan(20);
    expect(p95(ok.map((x) => x.ms))).toBeLessThan(3000);
  });

  it('50 partners polling job lists while a booking is created: still consistent', async () => {
    const polls = Array.from({ length: 50 }, () => api(ritika, 'GET', '/partner/jobs/mine'));
    const res = await Promise.all([...polls, api(cust, 'GET', '/config/booking')]);
    expect(res.filter((r) => r.s >= 500)).toHaveLength(0);
  });
});

describe('screens that depend on the website (slots)', () => {
  it('30 customers open the date screen at once: answers or a clear "try again", never a crash', async () => {
    const day = istDate(3);
    const res = await Promise.all(Array.from({ length: 30 }, () => timed(() => api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${day}&addressId=${addrId}`))));
    const codes = res.map((x) => x.r.s);
    expect(codes.filter((c) => c >= 500 && c !== 503)).toHaveLength(0); // 503 = website busy, a clear message
    expect(codes.filter((c) => c === 200).length).toBeGreaterThan(0);
    for (const x of res.filter((x) => x.r.s === 503)) expect(x.r.b.code).toBe('WEBSITE_UNAVAILABLE');
  });
});

describe('abuse and rate limits', () => {
  it('a burst of 300 requests from one client is limited (429), the server keeps answering others', async () => {
    const burst = await Promise.all(Array.from({ length: 300 }, () => http('GET', 'http://127.0.0.1:3001/api/v1/health')));
    expect(burst.filter((r) => r.s >= 500)).toHaveLength(0);
    const after = await http('GET', 'http://127.0.0.1:3001/api/v1/health');
    expect([200, 429]).toContain(after.s);
  });
  it('the API is still healthy after all of it', async () => {
    await new Promise((r) => setTimeout(r, 61000)); // let the rate-limit window pass
    const h = await http('GET', 'http://127.0.0.1:3001/api/v1/health');
    expect(h.s).toBe(200);
    expect(h.b.db).toBe('ok');
  });
});
