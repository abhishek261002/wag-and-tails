// The plugin as the only panel: partners, Aadhaar storage, money, payouts, support, the app side of a customer, the
// activity log, and who may do what. LOCAL ONLY (API on :3001, dev DB, staging WordPress on :8090).
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { aadhaarNumber, API, ADMIN, api, http, otpLogin, preflight, signedApi, sql, wpRest, login } from './helpers';

const stamp = String(Date.now()).slice(-6);
const P = (n: number) => `+9199${stamp}${n}0`.slice(0, 13); // +91 99 + 6 digits + 2 = 12 chars after +? keep 13 total
const phones = [P(1), P(2), P(3), P(4)];
const ids: string[] = [];
const OWNER = { by: 'Owner Test', role: 'admin' as const };
const STAFFER = { by: 'Desk Test', role: 'staff' as const };
let adminTok = '';

const panel = <T = any>(method: string, p: string, o: { query?: Record<string, string | number>; body?: unknown } = {}) => signedApi<T>(method, 'connector/panel/' + p, o);
const who = (c: { by: string; role: string }) => ({ by: c.by, role: c.role });

async function png(color: string) {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: color } }).png().toBuffer();
}

async function makePartner(i: number, status = 'pending', city = 'Lucknow', last4: string | null = null) {
  const ph = phones[i]!;
  const uid = sql(`insert into users(phone, email, role, is_active, updated_at) values ('${ph}', 'e2e${stamp}${i}@test.in', 'partner', true, now()) returning id`).split('\n')[0]!;
  sql(`insert into user_profiles(user_id, first_name, last_name, updated_at) values ('${uid}', 'Panel', 'Tester${i}', now())`);
  sql(`insert into partner_profiles(user_id, status, modes, city, aadhaar_last4, kyc_status, updated_at) values ('${uid}', '${status}', '{grooming}', '${city}', ${last4 ? `'${last4}'` : 'null'}, 'verified', now())`);
  ids[i] = uid;
  return uid;
}

async function partnerLogin(i: number) {
  return otpLogin(phones[i]!);
}

async function uploadSide(tok: string, side: 'front' | 'back', color = '#c0392b') {
  const fd = new FormData();
  fd.append('side', side);
  fd.append('file', new Blob([await png(color)], { type: 'image/png' }), `${side}.png`);
  const r = await fetch(API + '/partner/aadhaar/photo', { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: fd });
  const text = await r.text();
  return { s: r.status, b: (() => { try { return JSON.parse(text); } catch { return text; } })() };
}

beforeAll(async () => {
  await preflight();
  adminTok = await login(ADMIN.email, ADMIN.password);
  await makePartner(0, 'pending');
  await makePartner(1, 'pending');
  await makePartner(2, 'approved');
}, 60000);

afterAll(() => {
  for (const id of ids) if (id) {
    sql(`delete from audit_logs where entity_id='${id}'`);
    sql(`delete from users where id='${id}'`);
  }
  sql(`delete from users where phone like '+9199${stamp}%'`);
  try {
    for (const f of fs.readdirSync(path.resolve('./private-uploads'))) if (ids.some((id) => id && f.includes(id))) fs.unlinkSync(path.resolve('./private-uploads', f));
  } catch { /* none */ }
});

describe('the panel API accepts only signed calls from the website', () => {
  it('refuses unsigned, wrongly signed, replayed and stale calls', async () => {
    expect((await http('GET', API + '/connector/panel/overview')).s).toBe(401);
    expect((await panel('GET', 'overview', { query: {} }).then((r) => r.s))).toBe(200);
    const bad = await signedApi('GET', 'connector/panel/overview', { secret: 'not-the-secret' });
    expect(bad.s).toBe(401);
    const stale = await signedApi('GET', 'connector/panel/overview', { ts: Math.floor(Date.now() / 1000) - 3600 });
    expect(stale.s).toBe(401);
    const nonce = 'replay-nonce-' + stamp;
    expect((await signedApi('GET', 'connector/panel/overview', { nonce })).s).toBe(200);
    expect((await signedApi('GET', 'connector/panel/overview', { nonce })).s).toBe(401);
  });

  it('is not reachable with an app login (admin token is not a website signature)', async () => {
    expect((await api(adminTok, 'GET', '/connector/panel/overview')).s).toBe(401);
    expect((await api(adminTok, 'GET', '/connector/panel/partners')).s).toBe(401);
  });

  it('a signed call must say who is acting', async () => {
    const r = await panel('POST', `partners/${ids[2]}/suspend`, { body: { reason: 'x reason' } });
    expect(r.s).toBe(400);
    const r2 = await panel('POST', `partners/${ids[2]}/suspend`, { body: { by: 'X', role: 'superuser', reason: 'x reason' } });
    expect(r2.s).toBe(400);
  });

  it('a body changed after signing is refused', async () => {
    const r = await signedApi('POST', `connector/panel/partners/${ids[2]}/suspend`, { body: { ...who(OWNER), reason: 'tamper test' }, signedBody: JSON.stringify({ ...who(OWNER), reason: 'something else' }) });
    expect(r.s).toBe(401);
  });
});

describe('partners list and card', () => {
  it('lists partners with counts and filters by status and city', async () => {
    const r = await panel('GET', 'partners', { query: { status: 'pending' } });
    expect(r.s).toBe(200);
    expect(r.b.counts.pending).toBeGreaterThanOrEqual(2);
    expect(r.b.list.every((p: any) => p.status === 'pending')).toBe(true);
    const mine = r.b.list.find((p: any) => p.id === ids[0]);
    expect(mine.name).toBe('Panel Tester0');
    expect(mine.aadhaar).toBe(false);
    const none = await panel('GET', 'partners', { query: { status: 'pending', city: 'Nowhereville' } });
    expect(none.b.list).toHaveLength(0);
    expect((await panel('GET', 'partners', { query: { status: 'weird' } })).s).toBe(400);
  });

  it('the card never contains a full Aadhaar number, a hash, or a password hash', async () => {
    const r = await panel('GET', `partners/${ids[2]}`);
    expect(r.s).toBe(200);
    const text = JSON.stringify(r.b);
    expect(text).not.toMatch(/passwordHash|aadhaarRefHash|aadhaarEnc|aadhaarNumHash|"number"/);
    expect((await panel('GET', 'partners/not-a-uuid')).s).toBe(400);
    expect((await panel('GET', 'partners/00000000-0000-0000-0000-000000000000')).s).toBe(404);
  });
});

describe('Aadhaar number and photos', () => {
  let tok = '';
  const number = aadhaarNumber('23456789012');

  it('a partner cannot approve themselves and cannot be approved before the Aadhaar is added', async () => {
    const r = await panel('POST', `partners/${ids[0]}/approve`, { body: { ...who(STAFFER), employmentType: 'freelancer', city: 'Lucknow' } });
    expect(r.s).toBe(422);
    expect(r.b.code ?? r.b.message?.code).toBe('AADHAAR_REQUIRED');
  });

  it('refuses a number that fails the checksum, a missing consent, and a number before both photos', async () => {
    tok = await partnerLogin(0);
    const bad = await api(tok, 'POST', '/partner/aadhaar', { number: '234567890123', consent: true });
    expect(bad.s).toBe(400);
    const noConsent = await api(tok, 'POST', '/partner/aadhaar', { number, consent: false });
    expect(noConsent.s).toBe(400);
    const early = await api(tok, 'POST', '/partner/aadhaar', { number, consent: true });
    expect(early.s).toBe(400);
    expect(JSON.stringify(early.b)).toMatch(/photos/i);
  });

  it('accepts photos only, and only as images the server can read', async () => {
    const fd = new FormData();
    fd.append('side', 'front');
    fd.append('file', new Blob([Buffer.from('this is not an image at all')], { type: 'image/png' }), 'x.png');
    const r = await fetch(API + '/partner/aadhaar/photo', { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: fd });
    expect([400, 415]).toContain(r.status);
    const fd2 = new FormData();
    fd2.append('side', 'left');
    fd2.append('file', new Blob([await png('#123456')], { type: 'image/png' }), 'x.png');
    const r2 = await fetch(API + '/partner/aadhaar/photo', { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: fd2 });
    expect(r2.status).toBe(400);
  });

  it('stores photos and the number encrypted, never in plain, never in the public uploads folder', async () => {
    const f = await uploadSide(tok, 'front', '#c0392b');
    expect(f.s).toBe(201);
    const b = await uploadSide(tok, 'back', '#2980b9');
    expect(b.s).toBe(201);
    expect(b.b.back).toBe(true);
    const saved = await api(tok, 'POST', '/partner/aadhaar', { number, consent: true });
    expect([200, 201]).toContain(saved.s);
    expect(saved.b.done).toBe(true);
    expect(JSON.stringify(saved.b)).not.toContain(number);

    const row = sql(`select aadhaar_enc, aadhaar_front_file, aadhaar_back_file, aadhaar_last4 from partner_profiles where user_id='${ids[0]}'`);
    expect(row).not.toContain(number);
    expect(row).toContain(number.slice(-4));
    const file = row.split('|')[1]!;
    const onDisk = fs.readFileSync(path.resolve('./private-uploads', file));
    expect(onDisk.subarray(0, 4).toString()).toBe('WTA1'); // our encrypted format, not a PNG/JPEG
    expect(onDisk.subarray(0, 4).toString('hex')).not.toBe('89504e47');
    const pub = await http('GET', API.replace('/api/v1', '') + '/uploads/' + file);
    expect(pub.s).toBe(404);
    const prof = await api(tok, 'GET', '/partner/profile');
    expect(JSON.stringify(prof.b)).not.toContain(number);
    expect(JSON.stringify(prof.b)).not.toMatch(/aadhaarEnc|aadhaarFrontFile|aadhaarNumHash/);
    const st = await api(tok, 'GET', '/partner/aadhaar');
    expect(st.b.done).toBe(true);
    expect(JSON.stringify(st.b)).not.toContain(number);
  });

  it('one Aadhaar number can only be used by one partner', async () => {
    const t2 = await partnerLogin(1);
    await uploadSide(t2, 'front');
    await uploadSide(t2, 'back');
    const dup = await api(t2, 'POST', '/partner/aadhaar', { number, consent: true });
    expect(dup.s).toBe(409);
  });

  it('the number must end in the digits DigiLocker verified', async () => {
    sql(`update partner_profiles set aadhaar_last4='9999' where user_id='${ids[1]}'`);
    const t2 = await partnerLogin(1);
    const r = await api(t2, 'POST', '/partner/aadhaar', { number: aadhaarNumber('34567890123'), consent: true });
    expect(r.s).toBe(400);
    expect(JSON.stringify(r.b)).toMatch(/DigiLocker/);
    sql(`update partner_profiles set aadhaar_last4=null where user_id='${ids[1]}'`);
  });

  it('only the panel can read it back, it is logged with the person, and customers/partners cannot', async () => {
    const r = await panel('POST', `partners/${ids[0]}/aadhaar-reveal`, { body: who(STAFFER) });
    expect(r.s).toBe(200);
    expect(r.b.number).toBe(`${number.slice(0, 4)} ${number.slice(4, 8)} ${number.slice(8)}`);
    expect(r.b.front).toMatch(/^data:image\/(png|jpeg);base64,/);
    expect(r.b.back).toMatch(/^data:image\/(png|jpeg);base64,/);
    const log = sql(`select user_email, action from audit_logs where entity_id='${ids[0]}' and action='aadhaar_reveal' order by created_at desc limit 1`);
    expect(log).toContain('Website: Desk Test');
    expect((await api(tok, 'POST', `/connector/panel/partners/${ids[0]}/aadhaar-reveal`, who(STAFFER))).s).toBe(401);
    const cust = await otpLogin('+919876543210');
    expect((await api(cust, 'GET', '/partner/aadhaar')).s).toBe(403);
    expect((await api(cust, 'POST', '/partner/aadhaar', { number, consent: true })).s).toBe(403);
  });

  it('is only readable with the server key: a different key cannot decrypt', async () => {
    const { decrypt, encrypt } = await import('../../src/partners/aadhaar.service');
    const blob = encrypt(Buffer.from('123456789012'));
    expect(decrypt(blob).toString()).toBe('123456789012');
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decrypt(tampered)).toThrow();
    expect(blob.toString('latin1')).not.toContain('123456789012');
  });
});

describe('approve, reject, suspend and the role limits', () => {
  it('approval needs a city and a team/freelancer choice', async () => {
    expect((await panel('POST', `partners/${ids[0]}/approve`, { body: { ...who(STAFFER), employmentType: 'boss', city: 'Lucknow' } })).s).toBe(400);
    expect((await panel('POST', `partners/${ids[0]}/approve`, { body: { ...who(STAFFER), employmentType: 'team', city: '' } })).s).toBe(400);
  });

  it('a groomer is not approved before the photos of their tools are there', async () => {
    const r = await panel('POST', `partners/${ids[0]}/approve`, { body: { ...who(STAFFER), employmentType: 'freelancer', city: 'Lucknow' } });
    expect(r.s).toBe(422);
    expect(JSON.stringify(r.b)).toMatch(/tools/);
    for (let n = 1; n <= 3; n++) sql(`insert into partner_tool_media(partner_id, url, kind, mime_type, size_bytes) values ('${ids[0]}', '/uploads/e2e_${stamp}_${n}.jpg', 'image', 'image/jpeg', 1000)`);
  });

  it('staff can approve; the partner becomes active in the right city and type, and is logged', async () => {
    const r = await panel('POST', `partners/${ids[0]}/approve`, { body: { ...who(STAFFER), employmentType: 'freelancer', city: 'Lucknow' } });
    expect(r.s).toBe(200);
    expect(r.b.status).toBe('approved');
    expect(r.b.type).toBe('freelancer');
    expect(r.b.city).toBe('Lucknow');
    expect(sql(`select count(*) from audit_logs where entity_id='${ids[0]}' and action='partner.approve'`)).toBe('1');
    expect((await panel('POST', `partners/${ids[0]}/approve`, { body: { ...who(STAFFER), employmentType: 'freelancer', city: 'Lucknow' } })).s).toBe(400);
    const prof = await api(await partnerLogin(0), 'GET', '/partner/profile');
    expect(prof.b.status).toBe('approved');
  });

  it('rejects with a reason, the partner can not take jobs, and it can be approved later', async () => {
    expect((await panel('POST', `partners/${ids[1]}/reject`, { body: { ...who(STAFFER), reason: 'x' } })).s).toBe(400);
    const r = await panel('POST', `partners/${ids[1]}/reject`, { body: { ...who(STAFFER), reason: 'Photos are not clear' } });
    expect(r.s).toBe(200);
    expect(r.b.status).toBe('rejected');
    expect(r.b.rejectReason).toBe('Photos are not clear');
    const claim = await api(await partnerLogin(1), 'POST', '/partner/jobs/00000000-0000-0000-0000-000000000000/claim', {});
    expect(claim.s).toBe(403);
    expect((await panel('POST', `partners/${ids[2]}/reject`, { body: { ...who(STAFFER), reason: 'cannot reject approved' } })).s).toBe(400);
  });

  it('suspends and reactivates; an approved partner is never "rejected"', async () => {
    const s = await panel('POST', `partners/${ids[2]}/suspend`, { body: { ...who(STAFFER), reason: 'Customer complaint' } });
    expect(s.b.status).toBe('suspended');
    const a = await panel('POST', `partners/${ids[2]}/reactivate`, { body: who(STAFFER) });
    expect(a.b.status).toBe('approved');
    expect((await panel('POST', `partners/${ids[2]}/reactivate`, { body: who(STAFFER) })).s).toBe(400);
  });

  it('staff cannot change money; the owner can', async () => {
    const id = ids[0]!;
    expect((await panel('POST', `partners/${id}/dues-offline`, { body: { ...who(STAFFER), amount: 100, note: 'cash' } })).s).toBe(403);
    expect((await panel('POST', `partners/${id}/dues-adjust`, { body: { ...who(STAFFER), amount: 100, note: 'adj' } })).s).toBe(403);
    expect((await panel('POST', 'money/settings', { body: { ...who(STAFFER), defaultCommissionPct: 5 } })).s).toBe(403);
    expect((await panel('POST', 'money/reconcile', { body: who(STAFFER) })).s).toBe(403);
    expect((await panel('POST', `partners/${id}/commission`, { body: { ...who(STAFFER), commissionLimitOverride: 99999 } })).s).toBe(403);
    // commission % itself is shared work
    expect((await panel('POST', `partners/${id}/commission`, { body: { ...who(STAFFER), commissionPct: 25 } })).s).toBe(200);
    const adj = await panel('POST', `partners/${id}/dues-adjust`, { body: { ...who(OWNER), amount: 250, note: 'test adjustment' } });
    expect(adj.s).toBe(200);
    const card = await panel('GET', `partners/${id}`);
    expect(card.b.money.effective.due).toBe(250);
    expect(card.b.money.effective.commissionPct).toBe(25);
    expect((await panel('POST', `partners/${id}/dues-adjust`, { body: { ...who(OWNER), amount: -250, note: 'undo' } })).s).toBe(200);
    expect((await panel('POST', `partners/${id}/commission`, { body: { ...who(OWNER), commissionPct: 120 } })).s).toBe(400);
  });

  it('every change shows in the activity log with the person\'s name', async () => {
    const r = await panel('GET', 'activity', { query: { entityId: ids[0]! } });
    expect(r.s).toBe(200);
    const actions = r.b.list.map((x: any) => x.action);
    expect(actions).toEqual(expect.arrayContaining(['partner.approve', 'aadhaar_reveal']));
    expect(r.b.list.find((x: any) => x.action === 'partner.approve').by).toBe('Desk Test');
  });
});

describe('payouts', () => {
  it('lists due payouts, batches them (owner only) and needs a reference to mark paid', async () => {
    const id = ids[2]!;
    const pay = sql(`insert into payouts(partner_id, gross_amount, commission_rate, commission_amount, net_amount, status) values ('${id}', 1000, 30, 300, 700, 'pending') returning id`).split('\n')[0]!;
    const due = await panel('GET', 'payouts', { query: { status: 'pending' } });
    expect(due.b.list.find((x: any) => x.id === pay).net).toBe(700);
    expect((await panel('POST', 'payouts/batch', { body: { ...who(STAFFER), payoutIds: [pay] } })).s).toBe(403);
    expect((await panel('POST', 'payouts/batch', { body: { ...who(OWNER), payoutIds: [] } })).s).toBe(400);
    expect((await panel('POST', 'payouts/batch', { body: { ...who(OWNER), payoutIds: ['00000000-0000-0000-0000-000000000000'] } })).s).toBe(400);
    const batch = await panel('POST', 'payouts/batch', { body: { ...who(OWNER), payoutIds: [pay] } });
    expect(batch.s).toBe(200);
    // the same payout cannot go in a second batch
    expect((await panel('POST', 'payouts/batch', { body: { ...who(OWNER), payoutIds: [pay] } })).s).toBe(400);
    expect((await panel('POST', `payouts/batches/${batch.b.id}/paid`, { body: { ...who(STAFFER), reference: 'UTR123456' } })).s).toBe(403);
    expect((await panel('POST', `payouts/batches/${batch.b.id}/paid`, { body: { ...who(OWNER), reference: '' } })).s).toBe(400);
    const paid = await panel('POST', `payouts/batches/${batch.b.id}/paid`, { body: { ...who(OWNER), reference: 'UTR123456' } });
    expect(paid.s).toBe(200);
    expect(sql(`select status || '|' || coalesce(notes,'') from payouts where id='${pay}'`)).toBe('paid|Paid: UTR123456');
    expect((await panel('POST', `payouts/batches/${batch.b.id}/paid`, { body: { ...who(OWNER), reference: 'UTR123456' } })).s).toBe(400);
    sql(`delete from payouts where id='${pay}'`);
  });
});

describe('support tickets', () => {
  it('a customer ticket is answered from the panel and the reply reaches the customer', async () => {
    const cust = await otpLogin('+919876543210');
    const t = await api(cust, 'POST', '/support/tickets', { subject: `Panel test ${stamp}`, description: 'My groomer was late' });
    expect([200, 201]).toContain(t.s);
    const list = await panel('GET', 'tickets', { query: { status: 'open' } });
    const mine = list.b.list.find((x: any) => x.id === t.b.id);
    expect(mine.subject).toBe(`Panel test ${stamp}`);
    expect(mine.from.role).toBe('customer');
    expect(JSON.stringify(list.b)).not.toMatch(/passwordHash/);

    expect((await panel('POST', `tickets/${t.b.id}/reply`, { body: { ...who(STAFFER), text: '   ' } })).s).toBe(400);
    const rep = await panel('POST', `tickets/${t.b.id}/reply`, { body: { ...who(STAFFER), text: 'Sorry about that, we will look into it.' } });
    expect(rep.s).toBe(200);
    expect(rep.b.messages.at(-1).text).toContain('Sorry about that');
    expect(rep.b.messages.at(-1).from).toContain('Desk');
    expect(rep.b.status).toBe('in_progress');
    const msgs = await api(cust, 'GET', `/support/tickets/${t.b.id}/messages`);
    expect(JSON.stringify(msgs.b)).toContain('Sorry about that');

    expect((await panel('POST', `tickets/${t.b.id}/status`, { body: { ...who(STAFFER), status: 'nonsense' } })).s).toBe(400);
    expect((await panel('POST', `tickets/${t.b.id}/escalate`, { body: { ...who(STAFFER), reason: 'Refund needed' } })).b.escalated).toBe(true);
    expect((await panel('GET', 'tickets', { query: { escalated: 1 } })).b.list.some((x: any) => x.id === t.b.id)).toBe(true);
    expect((await panel('POST', `tickets/${t.b.id}/status`, { body: { ...who(OWNER), status: 'resolved' } })).b.status).toBe('resolved');
    sql(`delete from support_tickets where id='${t.b.id}'`);
  });

  it('another customer cannot read the ticket through the app API', async () => {
    const cust = await otpLogin('+919876543210');
    const t = await api(cust, 'POST', '/support/tickets', { subject: `Private ${stamp}`, description: 'Private matter' });
    const other = await partnerLogin(2);
    expect((await api(other, 'GET', `/support/tickets/${t.b.id}`)).s).toBe(403);
    sql(`delete from support_tickets where id='${t.b.id}'`);
  });
});

describe('the app side of a customer', () => {
  it('shows pets, bookings, orders for a phone, and nothing for an unknown one', async () => {
    const r = await panel('GET', 'customer', { query: { phone: '9876543210' } });
    expect(r.s).toBe(200);
    expect(r.b.app).toBe(true);
    expect(JSON.stringify(r.b)).not.toMatch(/passwordHash|email/);
    expect((await panel('GET', 'customer', { query: { phone: '9000000001' } })).b.app).toBe(false);
    expect((await panel('GET', 'customer', { query: { phone: '123' } })).s).toBe(400);
  });
});

describe('overview numbers', () => {
  it('counts what needs attention', async () => {
    const r = await panel('GET', 'overview');
    expect(r.s).toBe(200);
    expect(Object.keys(r.b)).toEqual(expect.arrayContaining(['partners', 'tickets', 'payouts', 'duesOwed', 'insuranceNew']));
    expect(r.b.partners.approved).toBeGreaterThanOrEqual(1);
  });
});

describe('plugin routes: who may call what (real WordPress permission checks)', () => {
  const routes: [string, string, string[]][] = [
    ['GET', '/wt/v1/panel/overview', ['admin', 'desk.lucknow']],
    ['GET', '/wt/v1/panel/partners', ['admin', 'desk.lucknow']],
    ['GET', '/wt/v1/panel/payouts', ['admin', 'desk.lucknow']],
    ['GET', '/wt/v1/panel/tickets', ['admin', 'desk.lucknow']],
    ['GET', '/wt/v1/panel/money', ['admin', 'desk.lucknow']],
    ['GET', '/wt/v1/panel/activity', ['admin']],
  ];
  it.each(routes)('%s %s', (method, route, allowed) => {
    expect([401, 403]).toContain(wpRest(null, method, route).s);
    for (const u of ['admin', 'desk.lucknow']) {
      const s = wpRest(u, method, route).s;
      if (allowed.includes(u)) expect(s).toBe(200);
      else expect([401, 403]).toContain(s);
    }
  });

  it('staff cannot make a batch or mark paid, and the owner is not blocked', () => {
    expect([401, 403]).toContain(wpRest('desk.lucknow', 'POST', '/wt/v1/panel/payouts/batch', { payoutIds: [] }).s);
    expect([401, 403]).toContain(wpRest('desk.lucknow', 'POST', '/wt/v1/panel/money/reconcile', {}).s);
    expect(wpRest('admin', 'POST', '/wt/v1/panel/payouts/batch', { payoutIds: [] }).s).toBe(400);
  });

  it('the plugin passes the real WordPress name and role, not what the browser claims', () => {
    const r = wpRest('desk.lucknow', 'POST', `/wt/v1/panel/partners/${ids[2]}/suspend`, { reason: 'Plugin test suspend', by: 'Hacker', role: 'admin' });
    expect(r.s).toBe(200);
    const log = sql(`select user_email || '|' || user_role from audit_logs where entity_id='${ids[2]}' and action='partner.suspend' order by created_at desc limit 1`);
    expect(log).toContain('|staff');
    expect(log).not.toContain('Hacker');
    wpRest('desk.lucknow', 'POST', `/wt/v1/panel/partners/${ids[2]}/reactivate`, {});
  });

  it('staff cannot change money through the plugin even by sending the fields', () => {
    expect(wpRest('desk.lucknow', 'POST', `/wt/v1/panel/partners/${ids[2]}/dues-adjust`, { amount: 500, note: 'x' }).s).toBe(403);
    expect(wpRest('desk.lucknow', 'POST', '/wt/v1/panel/money', { defaultCommissionPct: 1 }).s).toBe(403);
  });

  it('rejects unknown actions and bad ids', () => {
    expect(wpRest('admin', 'POST', `/wt/v1/panel/partners/${ids[2]}/delete-everything`, {}).s).toBe(400);
    expect([400, 404]).toContain(wpRest('admin', 'GET', '/wt/v1/panel/partners/xyz').s);
  });
});
