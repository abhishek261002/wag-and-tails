// Resilience audit: parts of the system failing while real people keep working. The website going down, a lost change
// message, a write that can never succeed, a payment that finishes after the held slot expired.
import { execFileSync } from 'child_process';
import {
  ADMIN, APP_CUSTOMER, COMPOSE, PARTNERS, SITE, api, bookedAt, drainOutbox, freeSlots, http, istDate, jobByRef, login, otpLogin, pluginBooking, preflight, resetWorld,
  signedWp, sleep, sql, userId, waitFor, websiteBooking, wp,
  cleanupAuditBookings,
} from './helpers';

let admin = '', ritika = '', cust = '';
let ritikaId = '', petId = '', addrId = '', pkgId = '';

const compose = (...args: string[]) => execFileSync('docker', ['compose', '-f', COMPOSE, ...args], { encoding: 'utf8' });
const siteUp = async () => (await http('GET', SITE + '/wt/v1/connector/config').catch(() => null))?.s === 401;
async function bringSiteBack() {
  compose('start', 'wordpress');
  for (let i = 0; i < 40; i++) { if (await siteUp()) return; await sleep(3000); }
  throw new Error('the staging website did not come back');
}

beforeAll(async () => {
  await preflight();
  resetWorld();
  admin = await login(ADMIN.email, ADMIN.password);
  ritika = await login(PARTNERS.ritika.email, PARTNERS.ritika.password);
  ritikaId = userId(PARTNERS.ritika.phone);
  cust = await otpLogin(APP_CUSTOMER);
  const custId = userId(APP_CUSTOMER);
  petId = sql(`select id from pets where customer_id='${custId}' and species='dog' and is_active limit 1`);
  addrId = sql(`select id from addresses where user_id='${custId}' and city='Lucknow' and pincode ~ '^[0-9]{6}$' limit 1`);
  pkgId = sql(`select id from grooming_packages where wp_id='pkfull'`);
  await api(admin, 'POST', '/admin/wp/sync');
});

afterAll(async () => { if (!(await siteUp())) await bringSiteBack().catch(() => {}); });

describe('the website goes down while people are working', () => {
  let ref = '', id = '';

  it('setup: a website booking, accepted by a partner who is already on the job', async () => {
    const date = istDate(3);
    ref = websiteBooking(date, (await freeSlots(date))[0]!);
    id = (await waitFor(() => jobByRef(ref).id || undefined))!;
    expect((await api(ritika, 'POST', `/partner/jobs/${id}/claim`)).s).toBeLessThan(300);
    await drainOutbox();
    expect((await pluginBooking(ref)).job.status).toBe('assigned');
  });

  it('with the website down: the partner app keeps working, the apps stay up, new app bookings are refused cleanly', async () => {
    compose('stop', 'wordpress');
    expect(await siteUp()).toBe(false);
    // the partner can still move the job along: nothing waits for the website
    expect((await api(ritika, 'PATCH', `/partner/jobs/${id}/on-the-way`, {})).s).toBe(200);
    expect((await api(ritika, 'PATCH', `/partner/jobs/${id}/arrived`, {})).s).toBe(200);
    // the apps themselves are healthy and still answer from their own data
    expect((await http('GET', 'http://127.0.0.1:3001/api/v1/health')).s).toBe(200);
    expect((await api(ritika, 'GET', '/partner/jobs/mine')).s).toBe(200);
    // booking in the app needs the website's calendar: a clear "try again", never a 500, never a half-made booking
    const before = sql(`select count(*) from bookings`);
    const slots = await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${istDate(4)}&addressId=${addrId}`);
    expect(slots.s).toBe(503);
    expect(slots.b.code).toBe('WEBSITE_UNAVAILABLE');
    const book = await api(cust, 'POST', '/bookings/grooming', { petId, packageId: pkgId, scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(), addressId: addrId, paymentMethod: 'cash_after_service' });
    expect(book.s).toBe(503);
    expect(book.b.code).toBe('WEBSITE_UNAVAILABLE');
    expect(sql(`select count(*) from bookings`)).toBe(before);
    // the admin can see the connection is unhealthy
    await api(admin, 'POST', '/admin/wp/sync');
    const st = await api(admin, 'GET', '/admin/wp/status');
    expect(st.s).toBe(200);
    expect(st.b.lastError).toBeTruthy();
    // the progress written meanwhile waits in the queue
    const q = await api(admin, 'GET', '/admin/wp/status');
    expect(q.b.outbox.pending).toBeGreaterThan(0);
  });

  it('when the website is back, the waiting writes arrive in order and nothing is lost or doubled', async () => {
    await bringSiteBack();
    const drained = await drainOutbox(120000);
    expect(drained).toBe(true);
    const pb = await pluginBooking(ref);
    expect(pb.job.status).toBe('arrived');
    expect(pb.job.partner.id).toBe(ritikaId);
    // finish the job; the completion also reaches the website
    await api(ritika, 'POST', `/partner/jobs/${id}/before-photos`, { urls: ['https://example.com/b.jpg'] });
    await api(ritika, 'PATCH', `/partner/jobs/${id}/verify-start`, { otp: sql(`select start_otp from bookings where id='${id}'`) });
    await api(ritika, 'POST', `/partner/jobs/${id}/collect-payment`, { method: 'cash' });
    const done = await api(ritika, 'PATCH', `/partner/jobs/${id}/complete`, { otp: sql(`select end_otp from bookings where id='${id}'`), checklistItems: [], afterPhotos: ['https://example.com/a.jpg'] });
    expect(done.s).toBe(200);
    await drainOutbox();
    expect((await pluginBooking(ref)).status).toBe('Completed');
    expect(Number(sql(`select count(*) from wp_outbox where failed_at is not null and done_at is null and created_at > now() - interval '30 minutes'`))).toBe(0);
  });
});

describe('a newer change arrives while an older write is still on its way to a slow website', () => {
  it('the newer change is not lost when the older write finishes', async () => {
    const date = istDate(7);
    const ref = websiteBooking(date, (await freeSlots(date))[1]!);
    const id = (await waitFor(() => jobByRef(ref).id || undefined))!;
    const aman = await login(PARTNERS.aman.email, PARTNERS.aman.password);
    const amanId = userId(PARTNERS.aman.phone);
    await drainOutbox();
    compose('pause', 'wordpress'); // the website accepts the connection but does not answer: writes hang
    try {
      expect((await api(ritika, 'POST', `/partner/jobs/${id}/claim`)).s).toBeLessThan(300); // write #1 starts and hangs
      await sleep(2500);
      expect((await api(ritika, 'POST', `/partner/jobs/${id}/release`, { reason: 'Bike broke down' })).s).toBe(200);
      expect((await api(aman, 'POST', `/partner/jobs/${id}/claim`)).s).toBeLessThan(300); // newer state: Aman
      await sleep(1500);
    } finally {
      compose('unpause', 'wordpress');
    }
    expect(await drainOutbox(120000)).toBe(true);
    const pb = await pluginBooking(ref);
    expect(pb.job.status).toBe('assigned');
    expect(pb.job.partner.id).toBe(amanId);
  });
});

describe('a website change message is lost', () => {
  it('the catch-up poll still turns the booking into a job and applies a later desk change', async () => {
    const date = istDate(5);
    const ref = websiteBooking(date, (await freeSlots(date))[0]!);
    // drop the queued messages before they are sent, as if the website could not reach us
    wp(`global $wpdb; $wpdb->query( "DELETE FROM {$wpdb->prefix}actionscheduler_actions WHERE hook='wt_conn_push'" );`);
    sql(`delete from bookings where wp_ref='${ref}'`);
    expect(jobByRef(ref).id).toBe('');
    const poll = await api(admin, 'POST', '/admin/wp/poll');
    expect(poll.s).toBe(201);
    const job = await waitFor(() => jobByRef(ref).id || undefined, 20000);
    expect(job).toBeTruthy();
    // and a desk change whose message was also lost
    const newStart = (await freeSlots(date))[3]!;
    expect((await signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body: { action: 'reschedule', date, start: newStart, reason: 'Audit move' } })).s).toBe(200);
    wp(`global $wpdb; $wpdb->query( "DELETE FROM {$wpdb->prefix}actionscheduler_actions WHERE hook='wt_conn_push'" );`);
    await api(admin, 'POST', '/admin/wp/poll');
    const moved = await waitFor(() => sql(`select to_char((scheduled_at at time zone 'UTC') at time zone 'Asia/Kolkata','HH24:MI') from bookings where wp_ref='${ref}'`).startsWith(newStart) || undefined, 20000);
    expect(moved).toBeTruthy();
  });
});

describe('a write to the website that can never succeed', () => {
  it('is marked failed for the admin (not retried for ever), and can be retried by hand', async () => {
    const id = sql(`select id from bookings where wp_ref is not null order by created_at desc limit 1`);
    sql(`insert into wp_outbox(booking_id,kind,dedupe_key,payload,updated_at) values ('${id}','action','audit:permanent-fail:${Date.now()}','{"path":"bookings/WT-DOES-NOT-EXIST/action","body":{"action":"cancel","reason":"Other","details":"audit"}}'::jsonb, now())`);
    const failed = await waitFor(async () => {
      await api(admin, 'GET', '/admin/wp/status');
      return Number(sql(`select count(*) from wp_outbox where dedupe_key like 'audit:permanent-fail:%' and failed_at is not null`)) === 1 || undefined;
    }, 40000, 2000);
    expect(failed).toBeTruthy();
    const st = await api(admin, 'GET', '/admin/wp/status');
    expect(st.b.outbox.failed.length).toBeGreaterThan(0);
    const rowId = sql(`select id from wp_outbox where dedupe_key like 'audit:permanent-fail:%' limit 1`);
    const retry = await api(admin, 'POST', `/admin/wp/outbox/${rowId}/retry`);
    expect(retry.s).toBe(201);
    sql(`delete from wp_outbox where dedupe_key like 'audit:permanent-fail:%'`);
  });
});

describe('payment finishes after the held slot expired and someone else took it', () => {
  it('the customer is refunded and told to pick another time; nobody is double-booked', async () => {
    const day = istDate(6);
    const slots = await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${day}&addressId=${addrId}`);
    const slotAt: string = slots.b[0];
    const start = new Date(slotAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const capacity = Number(sql(`select capacity from wp_cities where id='lucknow'`));
    // the customer starts an online booking: the slot is held as "Pending payment"
    const b = await api(cust, 'POST', '/bookings/grooming', { petId, packageId: pkgId, scheduledAt: slotAt, addressId: addrId, paymentMethod: 'upi' });
    expect(b.s).toBe(201);
    const bookingId = b.b.id;
    const ref = sql(`select wp_ref from bookings where id='${bookingId}'`);
    expect((await pluginBooking(ref)).status).toBe('Pending payment');
    const order = await api(cust, 'POST', '/payments/orders', { bookingId });
    expect(order.s).toBe(201);
    // the customer wanders off: the hold expires (20 minutes), and the slot fills up from the website
    wp(`$b = wt_rec_get('booking','${ref}'); $b['ts'] = time() - 3600; wt_rec_save('booking', $b);`);
    for (let i = 0; i < capacity; i++) websiteBooking(day, start, { phone: '9123400006', name: 'Audit Taker' });
    // …then the payment goes through
    const pay = await api(cust, 'PATCH', `/payments/${order.b.payment.id}/confirm`, { method: 'upi', providerPaymentId: 'pay_audit', signature: 'mock' });
    expect(pay.s).toBeLessThan(500);
    const row = sql(`select status||'|'||coalesce(cancel_reason,'') from bookings where id='${bookingId}'`);
    expect(row.startsWith('cancelled|')).toBe(true);
    expect(sql(`select count(*) from refunds r join payments p on p.id=r.payment_id where p.booking_id='${bookingId}'`)).toBe('1');
    await drainOutbox();
    expect(['Cancelled', 'Pending payment']).toContain((await pluginBooking(ref)).status);
    const booked = bookedAt('lucknow', day, start);
    expect(booked).toBe(capacity); // the fillers hold every place; the late payer holds none
  });
});

afterAll(() => { try { cleanupAuditBookings(); } catch { /* best effort */ } });
