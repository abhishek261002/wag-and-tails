// Security audit: who may call what, forged / replayed / stale / tampered signed calls in both directions, public
// tracking links, injection and oversized input, and what a customer must never be able to see.
import { randomBytes } from 'crypto';
import {
  ADMIN, API, APP_CUSTOMER, PARTNERS, SECRET, SITE, STAFF, api, http, istDate, freeSlots, jobByRef, login, otpLogin, preflight, resetWorld, signedApi, signedWp,
  sleep, sql, userId, waitFor, websiteBooking, wp,
  cleanupAuditBookings,
} from './helpers';

let admin = '', staff = '', ritika = '', cust = '';

beforeAll(async () => {
  await preflight();
  resetWorld();
  [admin, staff, ritika] = await Promise.all([login(ADMIN.email, ADMIN.password), login(STAFF.email, STAFF.password), login(PARTNERS.ritika.email, PARTNERS.ritika.password)]);
  cust = await otpLogin(APP_CUSTOMER);
});

describe('role access matrix (a role must not reach another role\'s endpoints)', () => {
  const cases: { name: string; method: string; path: string; allowed: string[] }[] = [
    { name: 'admin dashboard', method: 'GET', path: '/admin/dashboard', allowed: ['admin'] },
    { name: 'website sync status', method: 'GET', path: '/admin/wp/status', allowed: ['admin'] },
    { name: 'website sync now', method: 'POST', path: '/admin/wp/sync', allowed: ['admin'] },
    { name: 'website outbox retry', method: 'POST', path: '/admin/wp/outbox/00000000-0000-0000-0000-000000000000/retry', allowed: ['admin'] },
    { name: 'staff booking list', method: 'GET', path: '/staff/bookings', allowed: ['staff', 'admin'] },
    { name: 'staff customer list', method: 'GET', path: '/staff/customers', allowed: ['staff', 'admin'] },
    { name: 'partner profile', method: 'GET', path: '/partner/profile', allowed: ['partner'] },
    { name: 'partner open jobs', method: 'GET', path: '/partner/jobs/open', allowed: ['partner'] },
    { name: 'partner release', method: 'POST', path: '/partner/jobs/00000000-0000-0000-0000-000000000000/release', allowed: ['partner'] },
    { name: 'partner stop', method: 'POST', path: '/partner/jobs/00000000-0000-0000-0000-000000000000/stop', allowed: ['partner'] },
    { name: 'customer rewards', method: 'GET', path: '/me/rewards', allowed: ['customer'] },
    { name: 'customer complaints', method: 'GET', path: '/me/complaints', allowed: ['customer'] },
    { name: 'customer website bookings', method: 'GET', path: '/me/website-bookings', allowed: ['customer'] },
    { name: 'customer quote', method: 'POST', path: '/grooming/quote', allowed: ['customer'] },
  ];
  const tokens = () => ({ anonymous: null as string | null, customer: cust, partner: ritika, staff, admin });
  for (const c of cases) {
    it(`${c.name}: only ${c.allowed.join(' / ')}`, async () => {
      for (const [role, token] of Object.entries(tokens())) {
        const r = await api(token, c.method, c.path, c.method === 'GET' ? undefined : {});
        if (c.allowed.includes(role)) {
          // allowed roles reach the handler: anything but an auth failure (a 4xx for the dummy input is fine)
          expect([401, 403]).not.toContain(r.s);
        } else {
          expect([401, 403]).toContain(r.s);
        }
      }
    });
  }

  it('a customer cannot read another customer\'s booking', async () => {
    const other = sql(`select id from bookings where customer_id<>'${userId(APP_CUSTOMER)}' limit 1`);
    if (!other) return;
    const r = await api(cust, 'GET', `/bookings/${other}`);
    expect([403, 404]).toContain(r.s);
  });

  it('a partner cannot act on a job that is not theirs', async () => {
    const job = sql(`select id from bookings where partner_id is distinct from '${userId(PARTNERS.ritika.phone)}' and status in ('assigned','accepted') limit 1`);
    if (!job) return;
    for (const act of [['PATCH', 'on-the-way'], ['PATCH', 'arrived']] as const) {
      const r = await api(ritika, act[0], `/partner/jobs/${job}/${act[1]}`, {});
      expect([403, 404]).toContain(r.s);
    }
    const rel = await api(ritika, 'POST', `/partner/jobs/${job}/release`, { reason: 'not mine' });
    expect([403, 404]).toContain(rel.s);
  });

  it('the customer never receives the partner\'s KYC, bank or commission data', async () => {
    const id = sql(`select id from bookings where customer_id='${userId(APP_CUSTOMER)}' and partner_id is not null order by created_at desc limit 1`);
    if (!id) return;
    const r = await api(cust, 'GET', `/bookings/${id}`);
    const text = JSON.stringify(r.b);
    for (const secret of ['aadhaar', 'passwordHash', 'bankAccount', 'ifsc', 'commissionPct', 'releaseCount']) expect(text).not.toContain(secret);
  });
});

describe('signed calls INTO our backend (the plugin → API direction)', () => {
  const body = { type: 'booking', ref: 'WT-DOESNOTEXIST', op: 'update' };

  it('refuses an unsigned call', async () => {
    expect((await http('POST', API + '/connector/events', { body })).s).toBe(401);
  });
  it('refuses a wrong secret', async () => {
    expect((await signedApi('POST', 'connector/events', { body, secret: 'not-the-secret' })).s).toBe(401);
  });
  it('refuses a tampered body', async () => {
    expect((await signedApi('POST', 'connector/events', { body: { ...body, ref: 'WT-OTHER' }, signedBody: JSON.stringify(body) })).s).toBe(401);
  });
  it('refuses a different method or path than was signed', async () => {
    expect((await signedApi('POST', 'connector/events', { body, method: 'GET' })).s).toBe(401);
    const sig = (await import('./helpers')).signature('GET', '/api/v1/connector/desk/live', '', String(Math.floor(Date.now() / 1000)), 'abcdefabcdefabcdef');
    const r = await http('GET', API + '/connector/desk/partners?ref=WT-X', { headers: { 'X-WT-Timestamp': String(Math.floor(Date.now() / 1000)), 'X-WT-Nonce': 'abcdefabcdefabcdef', 'X-WT-Signature': sig } });
    expect(r.s).toBe(401);
  });
  it('refuses a stale timestamp (more than 5 minutes old) and a future one', async () => {
    expect((await signedApi('POST', 'connector/events', { body, ts: Math.floor(Date.now() / 1000) - 400 })).s).toBe(401);
    expect((await signedApi('POST', 'connector/events', { body, ts: Math.floor(Date.now() / 1000) + 400 })).s).toBe(401);
  });
  it('refuses a malformed nonce', async () => {
    expect((await signedApi('POST', 'connector/events', { body, nonce: 'short' })).s).toBe(401);
  });
  it('refuses a replay of an accepted call', async () => {
    const nonce = randomBytes(12).toString('hex');
    const first = await signedApi('POST', 'connector/events', { body: { type: 'enquiry', ref: 'x', op: 'insert' }, nonce });
    expect(first.s).toBe(200);
    const again = await signedApi('POST', 'connector/events', { body: { type: 'enquiry', ref: 'x', op: 'insert' }, nonce });
    expect(again.s).toBe(401);
  });
  it('desk endpoints refuse unsigned and customer/partner bearer tokens', async () => {
    for (const p of ['connector/desk/partners?ref=WT-X', 'connector/desk/live']) {
      expect((await http('GET', `${API}/${p}`)).s).toBe(401);
      expect((await http('GET', `${API}/${p}`, { token: cust })).s).toBe(401);
      expect((await http('GET', `${API}/${p}`, { token: admin })).s).toBe(401);
    }
    expect((await http('POST', API + '/connector/desk/assign', { token: admin, body: { ref: 'WT-X', partnerId: userId(PARTNERS.ritika.phone) } })).s).toBe(401);
  });
  it('an event for a booking that does not exist is answered without creating anything', async () => {
    const before = sql(`select count(*) from bookings`);
    const r = await signedApi('POST', 'connector/events', { body });
    expect([200, 404, 502, 503]).toContain(r.s);
    expect(sql(`select count(*) from bookings`)).toBe(before);
  });
});

describe('signed calls INTO the website (the API → plugin direction)', () => {
  it('refuses unsigned, wrong secret, stale, replayed and tampered calls', async () => {
    expect((await http('GET', SITE + '/wt/v1/connector/config')).s).toBe(401);
    expect((await signedWp('GET', '/wt/v1/connector/config', { secret: 'nope' })).s).toBe(401);
    expect((await signedWp('GET', '/wt/v1/connector/config', { ts: Math.floor(Date.now() / 1000) - 600 })).s).toBe(401);
    const nonce = randomBytes(12).toString('hex');
    expect((await signedWp('GET', '/wt/v1/connector/config', { nonce })).s).toBe(200);
    expect((await signedWp('GET', '/wt/v1/connector/config', { nonce })).s).toBe(401);
    const ref = 'WT-NOPE';
    const body = { action: 'cancel', reason: 'Other', details: 'x' };
    expect((await signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body, signedBody: JSON.stringify({ ...body, details: 'y' }) })).s).toBe(401);
  });
  it('a website visitor or customer cannot call the Connector with a WordPress cookie or nonce alone', async () => {
    expect((await http('POST', SITE + '/wt/v1/connector/bookings', { body: { jobId: 'abcdefgh-1234' } })).s).toBe(401);
    expect((await http('POST', SITE + '/wt/v1/connector/points', { body: { phone: '9123400001', pts: 999999, key: 'abcdefgh-1' } })).s).toBe(401);
  });
  it('the public booking-verify endpoint does not leak a booking to someone who only knows the reference', async () => {
    const date = istDate(3);
    const slots = await freeSlots(date);
    const ref = websiteBooking(date, slots[0]!);
    const r = await http('POST', SITE + '/wt/v1/bookings/verify', { body: { ref } });
    const txt = JSON.stringify(r.b);
    expect(txt).not.toContain('Audit Customer');
    expect(txt).not.toContain('9123400001');
    expect(txt).not.toContain('Gomti Nagar');
  });
  it('desk and admin routes of the plugin refuse the public', async () => {
    for (const p of ['/wt/v1/desk/bookings', '/wt/v1/desk/apps/partners?ref=WT-X', '/wt/v1/desk/apps/live', '/wt/v1/admin/customers', '/wt/v1/admin/staff', '/wt/v1/admin/dashboard']) {
      const r = await http('GET', SITE + p);
      expect([401, 403]).toContain(r.s);
    }
    expect([401, 403]).toContain((await http('POST', SITE + '/wt/v1/admin/config', { body: { settings: { notifyEmail: 'attacker@example.test' } } })).s);
    expect([401, 403]).toContain((await http('POST', SITE + '/wt/v1/desk/apps/assign', { body: { ref: 'WT-X', partnerId: userId(PARTNERS.ritika.phone) } })).s);
  });
  it('the plugin does not serve the connector secret or API secrets to the browser', async () => {
    const boot = await http('GET', SITE.replace('/wp-json', '/'));
    const html = String(boot.b);
    expect(html).not.toContain(SECRET);
    expect(html).not.toMatch(/WT_CONNECTOR_SECRET/);
  });
});

describe('public tracking page', () => {
  it('rejects guessable and malformed tokens', async () => {
    for (const t of ['1', 'abc', 'not-a-real-token-123', '../../etc/passwd', '%00', 'a'.repeat(200)]) {
      const r = await http('GET', `${API}/track/${encodeURIComponent(t)}/data`);
      expect([400, 404]).toContain(r.s);
    }
  });
  it('shows no customer phone, address or payment details for a real link', async () => {
    const token = sql(`select track_token from bookings where track_token is not null order by created_at desc limit 1`);
    if (!token) return;
    const r = await http('GET', `${API}/track/${token}/data`);
    expect(r.s).toBe(200);
    const txt = JSON.stringify(r.b);
    for (const leak of ['9123400001', '+91', 'Gomti', 'startOtp', 'endOtp', 'commission', 'customerId']) expect(txt).not.toContain(leak);
  });
  it('page has no-store, noindex and a content security policy', async () => {
    const token = sql(`select track_token from bookings where track_token is not null order by created_at desc limit 1`);
    if (!token) return;
    const r = await http('GET', `${API}/track/${token}`);
    expect(r.s).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    expect(r.headers.get('x-robots-tag')).toMatch(/noindex/);
    expect(r.headers.get('content-security-policy')).toMatch(/default-src/);
  });
});

describe('hostile input', () => {
  it('SQL-ish and script input in search and text fields is treated as plain text', async () => {
    const evil = ["' OR '1'='1", '"; DROP TABLE users; --', '<script>alert(1)</script>', '${7*7}', '{{7*7}}'];
    for (const e of evil) {
      const r = await api(staff, 'GET', `/staff/customers?search=${encodeURIComponent(e)}`);
      expect(r.s).toBeLessThan(500);
    }
    expect(Number(sql(`select count(*) from users`))).toBeGreaterThan(3);
  });
  it('malformed JSON and oversized bodies are refused cleanly (no 500)', async () => {
    const bad = await http('POST', API + '/auth/login', { raw: '{"email": ' });
    expect(bad.s).toBe(400);
    const big = await http('POST', API + '/auth/login', { raw: JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(2_000_000) }) });
    expect([400, 401, 413, 422]).toContain(big.s);
  });
  it('bad ids and missing records give 4xx, not 500', async () => {
    for (const p of ['/bookings/not-a-uuid', '/bookings/00000000-0000-0000-0000-000000000000', '/grooming/packages/nope']) {
      expect((await api(cust, 'GET', p)).s).toBeLessThan(500);
    }
    expect((await api(ritika, 'POST', '/partner/jobs/not-a-uuid/claim')).s).toBeLessThan(500);
  });
  it('a complaint photo link must be http(s), and script/data/javascript URLs are dropped before reaching the website', async () => {
    const r = await api(cust, 'POST', '/me/complaints', { category: 'Other', text: 'Testing hostile photo links here.', photos: ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd'] });
    expect([201, 422]).toContain(r.s);
    const c = r.b?.complaint;
    if (c) expect(JSON.stringify(c.photos ?? [])).not.toMatch(/javascript:|data:|file:/);
  });
  it('rapid wrong logins are throttled or refused, never accepted', async () => {
    let accepted = 0;
    for (let i = 0; i < 12; i++) {
      const r = await api(null, 'POST', '/auth/login', { email: ADMIN.email, password: 'wrong-' + i });
      if (r.s === 200 || r.s === 201) accepted++;
    }
    expect(accepted).toBe(0);
  });
  it('uploads: wrong type is refused, unknown purpose is refused', async () => {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from('<?php echo 1; ?>')], { type: 'image/jpeg' }), 'x.php.jpg');
    form.append('entity', 'complaint');
    form.append('entityId', 'audit');
    const r = await fetch(API + '/files/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + cust }, body: form });
    expect([400, 415, 422]).toContain(r.status);
    const form2 = new FormData();
    form2.append('file', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])], { type: 'image/jpeg' }), 'a.jpg');
    form2.append('entity', 'admin_secrets');
    form2.append('entityId', 'x');
    const r2 = await fetch(API + '/files/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + cust }, body: form2 });
    expect([400, 415, 422]).toContain(r2.status);
  });
});

afterAll(() => { try { cleanupAuditBookings(); } catch { /* best effort */ } });
