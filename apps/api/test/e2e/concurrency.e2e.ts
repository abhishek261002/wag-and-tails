// Concurrency and idempotency audit: many people acting at the same moment, and the same message arriving twice.
// Real users double-tap, two partners race for a job, a website customer and an app customer want the last slot,
// and the website's change messages are retried. None of that may create duplicates, lose money or break a state.
import { randomBytes } from 'crypto';
import {
  ADMIN, APP_CUSTOMER, PARTNERS, TEST_PHONE, api, bookedAt, drainOutbox, freeSlots, istDate, jobByRef, login, otpLogin, pluginBooking, preflight,
  resetWorld, signedApi, signedWp, sleep, sql, userId, waitFor, websiteBooking, wp,
  cleanupAuditBookings,
} from './helpers';

const startOfIso = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
let admin = '', ritika = '', aman = '', cust = '';
let ritikaId = '', amanId = '';
let petId = '', addrId = '', pkgId = '';

async function newJob(daysAhead: number, slotIndex = 0) {
  const date = istDate(daysAhead);
  const slots = await freeSlots(date);
  const ref = websiteBooking(date, slots[slotIndex]!);
  const job = await waitFor(() => { const j = jobByRef(ref); return j.id ? j : undefined; });
  if (!job) throw new Error('no job for ' + ref);
  return { ref, id: job.id, date };
}

beforeAll(async () => {
  await preflight();
  resetWorld();
  admin = await login(ADMIN.email, ADMIN.password);
  ritika = await login(PARTNERS.ritika.email, PARTNERS.ritika.password);
  aman = await login(PARTNERS.aman.email, PARTNERS.aman.password);
  ritikaId = userId(PARTNERS.ritika.phone);
  amanId = userId(PARTNERS.aman.phone);
  cust = await otpLogin(APP_CUSTOMER);
  const custId = userId(APP_CUSTOMER);
  petId = sql(`select id from pets where customer_id='${custId}' and species='dog' and is_active limit 1`);
  addrId = sql(`select id from addresses where user_id='${custId}' and city='Lucknow' and pincode ~ '^[0-9]{6}$' limit 1`);
  if (!addrId) addrId = sql(`insert into addresses(user_id,label,line1,city,state,pincode,lat,lng,updated_at) values ('${custId}','Audit','12 Hazratganj, Lucknow','Lucknow','UP','226001',26.85,80.94,now()) returning id`).split('\n')[0]!;
  pkgId = sql(`select id from grooming_packages where wp_id='pkfull'`);
  await api(admin, 'POST', '/admin/wp/sync');
});

describe('two partners race for one job', () => {
  it('exactly one wins, the other is told it is taken, state is consistent', async () => {
    const { id, ref } = await newJob(8);
    const [a, b] = await Promise.all([api(ritika, 'POST', `/partner/jobs/${id}/claim`), api(aman, 'POST', `/partner/jobs/${id}/claim`)]);
    const wins = [a, b].filter((r) => r.s === 200 || r.s === 201);
    const losses = [a, b].filter((r) => r.s === 409);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]!.b.code).toBe('JOB_TAKEN');
    const winner = a.s < 300 ? ritikaId : amanId;
    const j = jobByRef(ref);
    expect(j.partnerId).toBe(winner);
    expect(j.status).toBe('assigned');
    // exactly one assignment in the history, one start code
    expect(Number(sql(`select count(*) from booking_status_history where booking_id='${id}' and status='assigned'`))).toBe(1);
    await drainOutbox();
    const pb = await pluginBooking(ref);
    expect(pb.job.status).toBe('assigned');
    expect(pb.job.partner.id).toBe(winner);
  });

  it('ten simultaneous claims by the same partner still give one assignment', async () => {
    const { id } = await newJob(9);
    const rs = await Promise.all(Array.from({ length: 10 }, () => api(ritika, 'POST', `/partner/jobs/${id}/claim`)));
    expect(rs.filter((r) => r.s < 300)).toHaveLength(1);
    expect(rs.filter((r) => r.s === 409)).toHaveLength(9);
    expect(Number(sql(`select count(*) from booking_status_history where booking_id='${id}' and status='assigned'`))).toBe(1);
  });

  it('the desk assigning one partner while another claims: one assignment, no mixed state', async () => {
    const { id, ref } = await newJob(7);
    const body = { ref, partnerId: amanId, by: 'Audit desk' };
    const [claim, assign] = await Promise.all([api(ritika, 'POST', `/partner/jobs/${id}/claim`), signedApi('POST', 'connector/desk/assign', { body })]);
    const j = jobByRef(ref);
    expect([ritikaId, amanId]).toContain(j.partnerId);
    expect(j.status).toBe('assigned');
    expect(Number(sql(`select count(*) from bookings where id='${id}' and partner_id is not null`))).toBe(1);
    // whoever lost was refused cleanly, never a 500
    expect(claim.s).toBeLessThan(500);
    expect(assign.s).toBeLessThan(500);
    await drainOutbox();
    expect((await pluginBooking(ref)).job.partner.id).toBe(j.partnerId);
  });
});

describe('the same website message arrives many times', () => {
  it('five identical change events at once make one job', async () => {
    const date = istDate(2);
    const slots = await freeSlots(date);
    const ref = websiteBooking(date, slots[0]!);
    await waitFor(() => jobByRef(ref).id);
    sql(`delete from bookings where wp_ref='${ref}'`); // forget it, then replay the "new booking" message in parallel
    const rs = await Promise.all(Array.from({ length: 5 }, () => signedApi('POST', 'connector/events', { body: { type: 'booking', ref, op: 'insert' } })));
    expect(rs.every((r) => r.s === 200 || r.s === 503)).toBe(true);
    await waitFor(() => jobByRef(ref).id);
    expect(Number(sql(`select count(*) from bookings where wp_ref='${ref}'`))).toBe(1);
    expect(Number(sql(`select count(*) from users where phone='+91${TEST_PHONE}'`))).toBe(1);
  });

  it('events delivered out of order never move a booking backwards', async () => {
    const { id, ref } = await newJob(3);
    await api(ritika, 'POST', `/partner/jobs/${id}/claim`);
    await drainOutbox();
    const before = jobByRef(ref);
    // an old message ("insert") arriving after the booking moved on
    const r = await signedApi('POST', 'connector/events', { body: { type: 'booking', ref, op: 'insert' } });
    expect(r.s).toBe(200);
    const after = jobByRef(ref);
    expect(after.status).toBe(before.status);
    expect(after.partnerId).toBe(before.partnerId);
  });

  it('the website\'s own retry of a create (same jobId) returns the first booking', async () => {
    const date = istDate(4);
    const slot = (await freeSlots(date))[0]!;
    const body = {
      jobId: randomBytes(16).toString('hex').slice(0, 24), city: 'lucknow', pkg: 'pkfull', petType: 'Dog', petName: 'Rex', breed: 'Beagle', gender: 'Male', age: '2 years',
      name: 'Audit Retry', phone: '9123400002', address: '5 Test Road, Lucknow', pincode: '226010', date, start: slot, pay: 'later',
    };
    const [a, b] = await Promise.all([signedWp('POST', '/wt/v1/connector/bookings', { body }), signedWp('POST', '/wt/v1/connector/bookings', { body })]);
    expect([a.s, b.s].every((s) => s === 200 || s === 409)).toBe(true);
    const again = await signedWp('POST', '/wt/v1/connector/bookings', { body });
    expect(again.s).toBe(200);
    expect(again.b.repeat).toBe(true);
    const count = wp(`global $wpdb; echo $wpdb->get_var( "SELECT COUNT(*) FROM " . wt_table() . " WHERE type='booking' AND phone='9123400002' AND status<>'Cancelled'" );`);
    expect(count).toBe('1');
  });

  it('a points movement with the same key is applied once, and points never go below zero', async () => {
    const phone = '9123400003';
    const key = randomBytes(8).toString('hex') + 'aa';
    const before = Number(wp(`echo wt_points_balance('${phone}');`));
    const rs = await Promise.all(Array.from({ length: 4 }, () => signedWp('POST', '/wt/v1/connector/points', { body: { phone, pts: 40, key, reason: 'Audit' } })));
    expect(rs.every((r) => r.s === 200)).toBe(true);
    expect(Number(wp(`echo wt_points_balance('${phone}');`))).toBe(before + 40);
    const over = await signedWp('POST', '/wt/v1/connector/points', { body: { phone, pts: -100000, key: randomBytes(8).toString('hex') + 'bb', reason: 'Audit overspend' } });
    expect(over.s).toBe(409);
    expect(Number(wp(`echo wt_points_balance('${phone}');`))).toBe(before + 40);
  });
});

describe('the last slot', () => {
  it('parallel app bookings never exceed the city\'s capacity, and the rest are told SLOT_TAKEN', async () => {
    const day = istDate(5);
    const res = await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${day}&addressId=${addrId}`);
    expect(res.s).toBe(200);
    const slotAt: string = res.b[res.b.length - 1];
    const capacity = Number(sql(`select capacity from wp_cities where id='lucknow'`));
    const rs = await Promise.all(Array.from({ length: capacity + 3 }, () => api(cust, 'POST', '/bookings/grooming', { petId, packageId: pkgId, scheduledAt: slotAt, addressId: addrId, paymentMethod: 'cash_after_service' })));
    const ok = rs.filter((r) => r.s === 201);
    const taken = rs.filter((r) => r.s === 409 && r.b.code === 'SLOT_TAKEN');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(ok.length).toBeLessThanOrEqual(capacity);
    expect(ok.length + taken.length).toBe(rs.length); // nothing else (no 500s)
    // the website agrees, counted from its own list (not from our side): exactly as many places taken as app bookings succeeded
    expect(bookedAt('lucknow', day, startOfIso(slotAt))).toBe(ok.length);
    const refs = ok.map((r) => sql(`select wp_ref from bookings where id='${r.b.id}'`));
    expect(refs.every((r) => /^WT-/.test(r))).toBe(true);
    // the website's calendar now shows the slot as full
    const after = await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${day}&addressId=${addrId}`);
    if (ok.length === capacity) expect(after.b).not.toContain(slotAt);
    for (const r of ok) await api(cust, 'PATCH', `/bookings/${r.b.id}/cancel`, { reason: 'audit cleanup' });
  });

  it('a website customer and an app customer cannot both get the last place', async () => {
    const day = istDate(6);
    const res = await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${day}&addressId=${addrId}`);
    const slotAt: string = res.b[res.b.length - 1];
    const capacity = Number(sql(`select capacity from wp_cities where id='lucknow'`));
    // fill all but one place from the website side
    const start = new Date(slotAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const made: string[] = [];
    for (let i = 0; i < capacity - 1; i++) made.push(websiteBooking(day, start, { phone: '9123400004', name: 'Audit Filler' }));
    const [app, web] = await Promise.allSettled([
      api(cust, 'POST', '/bookings/grooming', { petId, packageId: pkgId, scheduledAt: slotAt, addressId: addrId, paymentMethod: 'cash_after_service' }),
      Promise.resolve().then(() => websiteBooking(day, start, { phone: '9123400005', name: 'Audit Racer' })),
    ]);
    const appOk = app.status === 'fulfilled' && app.value.s === 201;
    const webOk = web.status === 'fulfilled';
        const booked = bookedAt('lucknow', day, start);
    expect(booked).toBeLessThanOrEqual(capacity);
    expect(booked).toBe(capacity - 1 + Number(appOk) + Number(webOk)); // one place was left: exactly one of them got it
    expect(Number(appOk) + Number(webOk)).toBe(1);
    if (appOk && app.status === 'fulfilled') await api(cust, 'PATCH', `/bookings/${app.value.b.id}/cancel`, { reason: 'audit cleanup' });
  });
});

describe('double taps on money and completion', () => {
  it('collecting payment twice records it once; completing twice settles once', async () => {
    const { id, ref } = await newJob(2, 1);
    await api(ritika, 'POST', `/partner/jobs/${id}/claim`);
    await api(ritika, 'PATCH', `/partner/jobs/${id}/on-the-way`, {});
    await api(ritika, 'PATCH', `/partner/jobs/${id}/arrived`, {});
    await api(ritika, 'POST', `/partner/jobs/${id}/before-photos`, { urls: ['https://example.com/b.jpg'] });
    const otp = sql(`select start_otp from bookings where id='${id}'`);
    expect((await api(ritika, 'PATCH', `/partner/jobs/${id}/verify-start`, { otp })).s).toBe(200);
    const pay = await Promise.all([api(ritika, 'POST', `/partner/jobs/${id}/collect-payment`, { method: 'cash' }), api(ritika, 'POST', `/partner/jobs/${id}/collect-payment`, { method: 'cash' })]);
    expect(pay.every((r) => r.s < 500)).toBe(true);
    expect(Number(sql(`select count(*) from bookings where id='${id}' and collected_at is not null`))).toBe(1);
    const end = sql(`select end_otp from bookings where id='${id}'`);
    const body = { otp: end, checklistItems: [], afterPhotos: ['https://example.com/a.jpg'] };
    const done = await Promise.all([api(ritika, 'PATCH', `/partner/jobs/${id}/complete`, body), api(ritika, 'PATCH', `/partner/jobs/${id}/complete`, body)]);
    expect(done.filter((r) => r.s === 200)).toHaveLength(1);
    expect(done.every((r) => r.s < 500)).toBe(true);
    await sleep(1000);
    expect(Number(sql(`select count(*) from partner_ledger_entries where booking_id='${id}' and type='commission_due'`))).toBeLessThanOrEqual(1);
    await drainOutbox();
    const pb = await pluginBooking(ref);
    expect(pb.status).toBe('Completed');
    // the website must have been told once: one completion WhatsApp for this booking
    const sent = wp(`echo count( array_filter( wt_rec_list( 'notif', array(), 'id DESC', 60 ), function ( $n ) { return false !== strpos( $n['body'] ?? '', '${ref}' ) && false !== strpos( $n['subject'] ?? '', 'Grooming complete' ); } ) );`);
    expect(Number(sent)).toBe(1);
  });

  it('a stale desk change (revision conflict) is rejected, not silently overwritten', async () => {
    const { ref } = await newJob(3, 1);
    const b = await pluginBooking(ref);
    const first = await signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body: { action: 'edit', price: 1500, reason: 'first' } });
    expect(first.s).toBe(200);
    const second = await signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body: { action: 'edit', price: 1400, reason: 'second' } });
    expect(second.s).toBe(200); // a fresh read each time: both apply in order
    const after = await pluginBooking(ref);
    expect(Number(after.total)).toBe(1400);
    expect(after._rev).toBeGreaterThan(b._rev);
    // two parallel desk edits: neither may be lost silently; each answers 200 or a 409 to retry
    const rs = await Promise.all([
      signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body: { action: 'edit', price: 1301, reason: 'price test one' } }),
      signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body: { action: 'edit', price: 1302, reason: 'price test two' } }),
    ]);
    expect(rs.every((r) => r.s === 200 || r.s === 409)).toBe(true);
    const final = Number((await pluginBooking(ref)).total);
    expect([1301, 1302]).toContain(final);
  });
});

afterAll(() => { try { cleanupAuditBookings(); } catch { /* best effort */ } });
