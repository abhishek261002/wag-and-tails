// Business-rule and edge-case audit: every decision approved in docs/booking-flows-integrated.md that a unit test
// cannot see, run against the real stack. Real users do awkward things: they cancel late, change their mind, book by
// phone with a custom package, use points, move a booking to a full slot.
import {
  ADMIN, APP_CUSTOMER, PARTNERS, api, drainOutbox, freeSlots, istDate, jobByRef, login, otpLogin, pluginBooking, preflight, resetWorld, deskAction, signedApi, signedWp, sleep,
  sql, userId, waitFor, websiteBooking, wp, wpJson,
  cleanupAuditBookings,
} from './helpers';

let admin = '', ritika = '', aman = '', cust = '';
let ritikaId = '', amanId = '', custId = '', petId = '', addrId = '', pkgId = '';

const startOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
async function newJob(days: number, idx = 0, extra: Record<string, unknown> = {}) {
  const date = istDate(days);
  const ref = websiteBooking(date, (await freeSlots(date))[idx]!, extra);
  const job = await waitFor(() => jobByRef(ref).id ? jobByRef(ref) : undefined);
  return { ref, id: job!.id, date };
}
async function appSlot(day: string, idx = 0) {
  const r = await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${day}&addressId=${addrId}`);
  return (r.b as string[])[idx]!;
}
async function appBooking(day: string, idx = 0, extra: Record<string, unknown> = {}) {
  return api(cust, 'POST', '/bookings/grooming', { petId, packageId: pkgId, scheduledAt: await appSlot(day, idx), addressId: addrId, paymentMethod: 'cash_after_service', ...extra });
}
async function claim(token: string, id: string) {
  const r = await api(token, 'POST', `/partner/jobs/${id}/claim`);
  expect(r.s).toBeLessThan(300);
  return r;
}
async function payLater(id: string) { return api(cust, 'POST', `/payments/bookings/${id}/pay-after-service`); }
async function runJob(partnerToken: string, id: string, mode: 'cash' | 'online' = 'cash') {
  expect((await api(partnerToken, 'PATCH', `/partner/jobs/${id}/on-the-way`, {})).s).toBe(200);
  expect((await api(partnerToken, 'PATCH', `/partner/jobs/${id}/arrived`, {})).s).toBe(200);
  await api(partnerToken, 'POST', `/partner/jobs/${id}/before-photos`, { urls: ['https://example.com/b.jpg'] });
  expect((await api(partnerToken, 'PATCH', `/partner/jobs/${id}/verify-start`, { otp: sql(`select start_otp from bookings where id='${id}'`) })).s).toBe(200);
  if (mode === 'cash') expect((await api(partnerToken, 'POST', `/partner/jobs/${id}/collect-payment`, { method: 'cash' })).s).toBe(200);
  return api(partnerToken, 'PATCH', `/partner/jobs/${id}/complete`, { otp: sql(`select end_otp from bookings where id='${id}'`), checklistItems: [], afterPhotos: ['https://example.com/a.jpg'] });
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
  custId = userId(APP_CUSTOMER);
  petId = sql(`select id from pets where customer_id='${custId}' and species='dog' and is_active limit 1`);
  addrId = sql(`select id from addresses where user_id='${custId}' and city='Lucknow' and pincode ~ '^[0-9]{6}$' limit 1`);
  pkgId = sql(`select id from grooming_packages where wp_id='pkfull'`);
  sql(`delete from partner_discounts where note like 'audit%'`);
  await api(admin, 'POST', '/admin/wp/sync');
});
afterAll(() => { sql(`delete from partner_discounts where note like 'audit%'`); });

describe('partners and money', () => {
  it('team partner is salaried: no commission, no dues, no payout share (8A)', async () => {
    const { id, ref } = await newJob(2);
    await claim(aman, id);
    expect(sql(`select commission_pct||'|'||commission_amount from bookings where id='${id}'`)).toBe('0.00|0.00');
    expect((await runJob(aman, id)).s).toBe(200);
    await sleep(1500);
    expect(Number(sql(`select count(*) from partner_ledger_entries where booking_id='${id}'`))).toBe(0);
    expect(Number(sql(`select count(*) from payouts where booking_id='${id}'`))).toBe(0);
    await drainOutbox();
    expect((await pluginBooking(ref)).status).toBe('Completed');
  });

  it('freelancer owes 20% commission on a cash job and nothing is double counted', async () => {
    const { id } = await newJob(2, 1);
    await claim(ritika, id);
    const total = Number(sql(`select total from bookings where id='${id}'`));
    expect((await runJob(ritika, id)).s).toBe(200);
    await sleep(1500);
    expect(Number(sql(`select coalesce(sum(amount),0) from partner_ledger_entries where booking_id='${id}' and type='commission_due'`))).toBeCloseTo(total * 0.2, 1);
  });

  it('a partner discount never lowers a website-priced job (one price list)', async () => {
    sql(`insert into partner_discounts(partner_id,percent,starts_at,ends_at,status,note,created_by,activated_by,updated_at) values ('${ritikaId}',30,now()-interval '1 day',now()+interval '30 days','active','audit discount','${ritikaId}','${ritikaId}',now())`);
    const { id, ref } = await newJob(3);
    const before = Number(sql(`select total from bookings where id='${id}'`));
    await claim(ritika, id);
    expect(Number(sql(`select total from bookings where id='${id}'`))).toBe(before);
    expect(sql(`select coalesce(partner_discount_pct::text,'none') from bookings where id='${id}'`)).toBe('none');
    await drainOutbox();
    expect(Number((await pluginBooking(ref)).total)).toBe(before);
    sql(`delete from partner_discounts where note like 'audit%'`);
  });

  it('release then another partner takes it: the new partner is priced afresh and the desk card follows', async () => {
    const { id, ref } = await newJob(4);
    await claim(ritika, id);
    expect((await api(ritika, 'POST', `/partner/jobs/${id}/release`, { reason: 'Vehicle problem' })).s).toBe(200);
    expect(jobByRef(ref).status).toBe('needs_partner');
    await claim(aman, id);
    expect(jobByRef(ref).partnerId).toBe(amanId);
    expect(jobByRef(ref).flag).toBe(''); // the release flag is cleared once someone has it
    expect(sql(`select commission_pct from bookings where id='${id}'`)).toBe('0.00'); // Aman is salaried
    await drainOutbox();
    expect((await pluginBooking(ref)).job.partner.id).toBe(amanId);
  });
});

describe('timers', () => {
  it('a partner who does not confirm a moved booking within the window loses it, and everyone is asked again (reconfirm)', async () => {
    const { id, ref } = await newJob(5);
    await claim(ritika, id);
    sql(`update bookings set reconfirm_by=now()-interval '1 minute' where id='${id}'`);
    const lapsed = await waitFor(() => jobByRef(ref).status === 'needs_partner' ? jobByRef(ref) : undefined, 100000, 3000);
    expect(lapsed).toBeTruthy();
    expect(lapsed!.partnerId).toBe('');
    expect(lapsed!.flag).toBe('reconfirm_lapsed');
  }, 130000);

  it('a customer\'s chosen partner who does not answer: the job goes to everyone (3A)', async () => {
    const r = await appBooking(istDate(6), 0, { assignmentMode: 'specific', requestedPartnerId: ritikaId });
    expect(r.s).toBe(201);
    const id = r.b.id;
    await payLater(id);
    expect(sql(`select assignment_mode from bookings where id='${id}'`)).toBe('specific');
    sql(`update bookings set request_expires_at=now()-interval '1 minute' where id='${id}'`);
    const open = await waitFor(() => sql(`select assignment_mode from bookings where id='${id}'`) === 'any' || undefined, 100000, 3000);
    expect(open).toBeTruthy();
    await api(cust, 'PATCH', `/bookings/${id}/cancel`, { reason: 'audit cleanup' });
  }, 130000);

  it('a partner who has not started the trip near the start time is flagged "running late"', async () => {
    const { id, ref } = await newJob(2, 2);
    await claim(ritika, id);
    // pin the website revision so the next sync does not put the website's start time back over this test's change
    sql(`update bookings set scheduled_at=now()+interval '5 minutes', wp_rev=999999 where id='${id}'`);
    const late = await waitFor(() => jobByRef(ref).flag === 'late' || undefined, 100000, 3000);
    expect(late).toBeTruthy();
    expect((await api(ritika, 'PATCH', `/partner/jobs/${id}/on-the-way`, {})).s).toBe(200);
    expect(jobByRef(ref).flag).toBe(''); // starting the trip clears it
  }, 130000);
});

describe('customer rules (app)', () => {
  it('cancel inside the cut-off is refused (call the desk); earlier is free and the partner is told', async () => {
    const a = await appBooking(istDate(7));
    await payLater(a.b.id);
    sql(`update bookings set scheduled_at=now()+interval '2 hours' where id='${a.b.id}'`);
    const late = await api(cust, 'PATCH', `/bookings/${a.b.id}/cancel`, { reason: 'late' });
    expect(late.s).toBe(403);
    expect(late.b.code).toBe('SELF_SERVICE_CLOSED');
    sql(`update bookings set scheduled_at=now()+interval '3 days' where id='${a.b.id}'`);
    await claim(ritika, a.b.id);
    expect([200, 204]).toContain((await api(cust, 'PATCH', `/bookings/${a.b.id}/cancel`, { reason: 'Plans changed' })).s);
    expect(sql(`select status from bookings where id='${a.b.id}'`)).toBe('cancelled');
    await drainOutbox();
    expect((await pluginBooking(sql(`select wp_ref from bookings where id='${a.b.id}'`))).status).toBe('Cancelled');
  });

  it('once the partner is on the way, the customer can no longer cancel in the app', async () => {
    const a = await appBooking(istDate(8));
    await payLater(a.b.id);
    await claim(ritika, a.b.id);
    await api(ritika, 'PATCH', `/partner/jobs/${a.b.id}/on-the-way`, {});
    const r = await api(cust, 'PATCH', `/bookings/${a.b.id}/cancel`, { reason: 'changed my mind' });
    expect(r.s).toBe(400);
    expect(sql(`select status from bookings where id='${a.b.id}'`)).toBe('partner_on_the_way');
  });

  it('moving a booking to a full slot is refused; to a free slot works and the partner must reconfirm', async () => {
    const day = istDate(4);
    const a = await appBooking(day, 0);
    await payLater(a.b.id);
    await claim(ritika, a.b.id);
    const capacity = Number(sql(`select capacity from wp_cities where id='lucknow'`));
    // a late slot that does not overlap this booking (a booking's own place is freed when it moves within its own time)
    const all = (await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${day}&addressId=${addrId}`)).b as string[];
    const full = all[all.length - 1]!;
    // fill the slot until the website says it is full (other bookings may already share its time span)
    for (let i = 0; i < capacity + 2; i++) {
      try { websiteBooking(day, startOf(full), { phone: '9123400007', name: 'Audit Filler' }); } catch { break; }
    }
    expect(await freeSlots(day)).not.toContain(startOf(full));
    const refused = await api(cust, 'PATCH', `/bookings/${a.b.id}/reschedule`, { scheduledAt: full, reason: 'test' });
    expect(refused.s).toBe(409);
    expect(refused.b.code).toBe('SLOT_TAKEN');
    const mine = sql(`select scheduled_at from bookings where id='${a.b.id}'`);
    const options = (await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${day}&addressId=${addrId}&bookingId=${a.b.id}`)).b as string[];
    // moving to the time it already has is refused up front (it would be a no-op the website rejects)
    const same = options.find((o) => new Date(o).getTime() === new Date(mine.replace(' ', 'T') + 'Z').getTime());
    if (same) {
      const noop = await api(cust, 'PATCH', `/bookings/${a.b.id}/reschedule`, { scheduledAt: same, reason: 'test' });
      expect(noop.s).toBe(400);
      expect(noop.b.code).toBe('SAME_TIME');
    }
    const free = options.find((o) => o !== same)!;
    const ok = await api(cust, 'PATCH', `/bookings/${a.b.id}/reschedule`, { scheduledAt: free, reason: 'test' });
    expect(ok.s).toBe(200);
    expect(sql(`select reconfirm_by is not null from bookings where id='${a.b.id}'`)).toBe('t');
    await drainOutbox();
    const pb = await pluginBooking(sql(`select wp_ref from bookings where id='${a.b.id}'`));
    expect(pb.status).toBe('Rescheduled');
    expect(pb.start).toBe(startOf(free));
  });

  it('the price the customer saw is protected: a changed price is refused (PRICE_CHANGED) and nothing is booked', async () => {
    const before = sql(`select count(*) from bookings`);
    const r = await appBooking(istDate(9), 0, { expectTotal: 1 });
    expect(r.s).toBe(409);
    expect(r.b.code).toBe('PRICE_CHANGED');
    expect(sql(`select count(*) from bookings`)).toBe(before);
  });

  it('points: used at checkout they come off the price, are taken from the balance, and come back on cancel', async () => {
    const before = Number(wp(`echo wt_points_balance('9876543210');`));
    const q = await api(cust, 'POST', '/grooming/quote', { packageId: pkgId, addressId: addrId, petId, usePoints: true });
    expect(q.s).toBe(201);
    expect(q.b.pointsUsed).toBeGreaterThan(0);
    expect(q.b.total).toBe(q.b.subtotal - q.b.ptsDiscount);
    const b = await appBooking(istDate(9), 1, { usePoints: true, expectTotal: q.b.total });
    expect(b.s).toBe(201);
    expect(Number(wp(`echo wt_points_balance('9876543210');`))).toBe(before - q.b.pointsUsed);
    expect(Number(sql(`select total from bookings where id='${b.b.id}'`))).toBe(q.b.total);
    await payLater(b.b.id);
    expect([200, 204]).toContain((await api(cust, 'PATCH', `/bookings/${b.b.id}/cancel`, { reason: 'audit' })).s);
    await drainOutbox();
    expect(Number(wp(`echo wt_points_balance('9876543210');`))).toBe(before);
  });

  it('a coupon applies the website\'s rules (PAMPER 10%), and an unknown code is refused', async () => {
    const ok = await api(cust, 'POST', '/grooming/quote', { packageId: pkgId, addressId: addrId, petId, couponCode: 'PAMPER' });
    expect(ok.s).toBe(201);
    expect(ok.b.discount).toBeCloseTo(ok.b.subtotal * 0.1, 0);
    const bad = await api(cust, 'POST', '/grooming/quote', { packageId: pkgId, addressId: addrId, petId, couponCode: 'NOSUCHCODE' });
    expect(bad.s).toBeGreaterThanOrEqual(400);
    expect(bad.s).toBeLessThan(500);
  });

  it('a customer sees only their own website bookings and points', async () => {
    const mine = await api(cust, 'GET', '/me/website-bookings');
    expect(mine.s).toBe(200);
    const phones = JSON.stringify(mine.b);
    expect(phones).not.toContain('9123400001');
    const other = await otpLogin('+91' + '9123400001');
    const theirs = await api(other, 'GET', '/me/website-bookings');
    expect(theirs.s).toBe(200);
    expect(theirs.b.bookings.length).toBeGreaterThan(0);
    expect(JSON.stringify(theirs.b)).not.toContain('Arjun');
  });
});

describe('desk bookings and desk powers', () => {
  it('a phone booking with a custom package becomes a job, is offered to partners and can be completed (13A)', async () => {
    const date = istDate(3);
    const start = (await freeSlots(date))[3]!;
    const res = wpJson<any>(`( wp_set_current_user(1) || true ) ? wt_desk_add( array( 'city'=>'lucknow','pkg'=>'__custom','customName'=>'Audit spa','customPrice'=>1850,'customMins'=>75,'source'=>'Phone call','name'=>'Audit Phone','phone'=>'9123400008','pincode'=>'226010','address'=>'8 Audit Lane, Lucknow','petType'=>'Dog','breed'=>'Labrador Retriever','gender'=>'Male','age'=>'4 years','date'=>'${date}','start'=>'${start}','pay'=>'later' ) ) : null`);
    const ref = res.booking?.id ?? res.id;
    expect(ref).toMatch(/^WT-/);
    const job = await waitFor(() => jobByRef(ref).id ? jobByRef(ref) : undefined);
    expect(job).toBeTruthy();
    expect(sql(`select channel||'|'||package_name||'|'||total from bookings where wp_ref='${ref}'`)).toBe('phone_call|Audit spa|1850.00');
    expect((await api(ritika, 'POST', `/partner/jobs/${job!.id}/claim`)).s).toBeLessThan(300);
    expect((await runJob(ritika, job!.id)).s).toBe(200);
    await drainOutbox();
    expect((await pluginBooking(ref)).status).toBe('Completed');
  });

  it('desk completes a job nobody did in the app (12A): job closes, money recorded, partner flow cannot continue', async () => {
    const { id, ref } = await newJob(6);
    await claim(ritika, id);
    const r = await deskAction(ref, { action: 'complete', mode: 'Cash', actor: 'Audit desk' });
    expect(r.s).toBe(200);
    expect(await waitFor(() => jobByRef(ref).status === 'completed' || undefined)).toBeTruthy();
    const late = await api(ritika, 'PATCH', `/partner/jobs/${id}/on-the-way`, {});
    expect([404, 409]).toContain(late.s);
    expect(Number(sql(`select count(*) from partner_ledger_entries where booking_id='${id}' and type='commission_due'`))).toBe(1);
  });

  it('desk cancels while the partner is on the way: job closes and the partner is not left with it', async () => {
    const { id, ref } = await newJob(7);
    await claim(ritika, id);
    await api(ritika, 'PATCH', `/partner/jobs/${id}/on-the-way`, {});
    await drainOutbox();
    expect((await deskAction(ref, { action: 'cancel', reason: 'Customer cancelled' })).s).toBe(200);
    expect(await waitFor(() => jobByRef(ref).status === 'cancelled' || undefined)).toBeTruthy();
    const arrive = await api(ritika, 'PATCH', `/partner/jobs/${id}/arrived`, {});
    expect([404, 409]).toContain(arrive.s);
  });

  it('desk assign/unassign through the signed desk endpoints, including refusing an impossible assignment', async () => {
    const { id, ref } = await newJob(8, 2);
    const list = await signedApi('GET', `connector/desk/partners?ref=${ref}`);
    expect(list.s).toBe(200);
    expect(list.b.partners.map((p: any) => p.id).sort()).toEqual([amanId, ritikaId].sort());
    expect((await signedApi('POST', 'connector/desk/assign', { body: { ref, partnerId: ritikaId, by: 'Audit' } })).s).toBe(200);
    expect((await signedApi('POST', 'connector/desk/assign', { body: { ref, partnerId: amanId, by: 'Audit' } })).s).toBe(200); // change
    expect(jobByRef(ref).partnerId).toBe(amanId);
    expect((await signedApi('POST', 'connector/desk/unassign', { body: { ref, by: 'Audit' } })).s).toBe(200);
    expect(jobByRef(ref).partnerId).toBe('');
    const cat = sql(`select id from users where phone='+919900004444'`); // a walker-only partner
    expect([400, 409, 422]).toContain((await signedApi('POST', 'connector/desk/assign', { body: { ref, partnerId: cat, by: 'Audit' } })).s);
    expect((await signedApi('POST', 'connector/desk/assign', { body: { ref: 'WT-NOPE', partnerId: ritikaId } })).s).toBe(404);
  });

  it('a desk price change while the groomer waits at the door does not restart the 15-minute wait', async () => {
    const { id, ref } = await newJob(9, 1);
    await claim(ritika, id);
    expect((await api(ritika, 'PATCH', `/partner/jobs/${id}/on-the-way`, {})).s).toBe(200);
    expect((await api(ritika, 'PATCH', `/partner/jobs/${id}/arrived`, {})).s).toBe(200);
    sql(`update booking_status_history set changed_at=now()-interval '20 minutes' where booking_id='${id}' and status='arrived' and note='Partner has arrived'`);
    await drainOutbox();
    expect((await deskAction(ref, { action: 'edit', price: 1550, reason: 'extra service at the door' })).s).toBe(200);
    // the desk change reaches the job (and writes its own history row, still with status "arrived")
    expect(await waitFor(() => sql(`select count(*) from booking_status_history where booking_id='${id}' and note like 'Changed on the desk%'`) !== '0' || undefined)).toBeTruthy();
    const r = await api(ritika, 'POST', `/partner/jobs/${id}/customer-not-available`, { photoUrl: 'https://example.com/door.jpg' });
    expect(r.s).toBe(200);
    expect(jobByRef(ref).flag).toBe('customer_not_available');
  });

  it('a partner with commission dues over the limit gets no offers and cannot claim (dues limit)', async () => {
    const { id } = await newJob(9);
    sql(`insert into partner_ledger_entries(partner_id,booking_id,type,amount,note) select '${ritikaId}', id, 'commission_due', 99999, 'audit dues' from bookings where id='${id}'`);
    const open = await api(ritika, 'GET', '/partner/jobs/open');
    expect(JSON.stringify(open.b)).not.toContain(id);
    const refused = await api(ritika, 'POST', `/partner/jobs/${id}/claim`);
    expect(refused.s).toBeGreaterThanOrEqual(400);
    sql(`delete from partner_ledger_entries where note='audit dues'`);
    await claim(ritika, id);
  });
});

afterAll(() => { try { cleanupAuditBookings(); } catch { /* best effort */ } });
