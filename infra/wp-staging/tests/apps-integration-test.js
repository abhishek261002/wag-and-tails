// End-to-end test of the website ↔ apps link (backend phases B2–B8, partner P1 actions) against the local staging
// WordPress (infra/wp-staging) and the local API (apps/api on :3001 with WP_CONNECTOR_URL / WP_CONNECTOR_SECRET set).
//
//   node infra/wp-staging/tests/apps-integration-test.js
//
// It changes local data only: it sets two seeded partners to Lucknow, creates website and app bookings with a test
// phone, and cleans up its own bookings first. Never point it at the live site or database.
const crypto = require('crypto');
const path = require('path');
const { execSync } = require('child_process');

const API = 'http://127.0.0.1:3001/api/v1';
const SITE = 'http://localhost:8090/wp-json';
const SECRET = 'local-dev-connector-secret-change-me';
const COMPOSE = path.join(__dirname, '..', 'docker-compose.yml');
const PG = 'docker exec wag_postgres_dev psql -U postgres -d wagandtails -tA -c';
const TEST_PHONE = '9123400001'; // website customer created by this test
let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  -> ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400))); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`${PG} ${JSON.stringify(q)}`).toString().trim();
const wp = (php) => execSync(`docker compose -f "${COMPOSE}" exec -T cli wp eval ${JSON.stringify(php)}`, { env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).toString().trim();
const runQueue = () => { try { execSync(`docker compose -f "${COMPOSE}" exec -T cli wp action-scheduler run --hooks=wt_conn_push --batch-size=50`, { env: { ...process.env, MSYS_NO_PATHCONV: '1' }, stdio: 'ignore' }); } catch {} };
const ist = (days) => new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

function canonical(route, query) {
  const keys = Object.keys(query || {}).sort();
  if (!keys.length) return route;
  return route + '?' + keys.map((k) => encodeURIComponent(k).replace(/%20/g, '+') + '=' + encodeURIComponent(String(query[k])).replace(/%20/g, '+')).join('&');
}
async function signedWp(method, route, { query, body } = {}) {
  const t = String(Math.floor(Date.now() / 1000)), n = crypto.randomBytes(12).toString('hex'), raw = body === undefined ? '' : JSON.stringify(body);
  const c = canonical(route, query);
  const sig = crypto.createHmac('sha256', SECRET).update(`${t}\n${n}\n${method}\n${c}\n${raw}`).digest('hex');
  const r = await fetch(SITE + c, { method, headers: { 'Content-Type': 'application/json', 'X-WT-Timestamp': t, 'X-WT-Nonce': n, 'X-WT-Signature': sig }, body: raw || undefined });
  const text = await r.text(); let b; try { b = JSON.parse(text); } catch { b = text; }
  return { s: r.status, b };
}
/** A call the plugin would make to our backend (desk endpoints), signed the same way. */
async function signedApi(method, pathq, body) {
  const t = String(Math.floor(Date.now() / 1000)), n = crypto.randomBytes(12).toString('hex'), raw = body === undefined ? '' : JSON.stringify(body);
  const sig = crypto.createHmac('sha256', SECRET).update(`${t}\n${n}\n${method}\n/api/v1/${pathq}\n${raw}`).digest('hex');
  const r = await fetch(`${API}/${pathq}`, { method, headers: { ...(raw ? { 'Content-Type': 'application/json' } : {}), 'X-WT-Timestamp': t, 'X-WT-Nonce': n, 'X-WT-Signature': sig }, body: raw || undefined });
  const text = await r.text(); let b; try { b = JSON.parse(text); } catch { b = text; }
  return { s: r.status, b };
}
async function api(token, method, p, body) {
  const r = await fetch(API + p, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text(); let b; try { b = JSON.parse(text); } catch { b = text; }
  return { s: r.status, b };
}
async function login(email, password) {
  const r = await api(null, 'POST', '/auth/login', { email, password });
  return r.b.accessToken || r.b.tokens?.accessToken;
}
async function otpLogin(phone) {
  const req = await api(null, 'POST', '/auth/otp/request', { phone });
  const v = await api(null, 'POST', '/auth/otp/verify', { phone, otp: req.b.otp });
  return v.b.accessToken || v.b.tokens?.accessToken;
}
const plugin = async (ref) => (await signedWp('GET', `/wt/v1/connector/bookings/${ref}`)).b.booking;
async function waitFor(fn, ms = 30000, step = 1500) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return v;
    runQueue();
    await sleep(step);
  }
}
async function drainOutbox() {
  return waitFor(() => sql(`select count(*) from wp_outbox where done_at is null and failed_at is null`) === '0', 30000, 1000);
}
/** A website booking made through the plugin's own website code (pay after service). */
function websiteBooking(date, start, extra = {}) {
  const fields = Object.assign({
    city: 'lucknow', pkg: 'pkfull', petType: 'Dog', breed: 'Golden Retriever', gender: 'Male', age: '3', ageUnit: 'years',
    aggression: 'Mild — nervous with strangers', name: 'Integration Test', email: 'it@example.test', phone: TEST_PHONE,
    address: 'House 7, Gomti Nagar, Lucknow', pincode: '226010', lat: 26.85, lng: 80.99, date, start, pay: 'later',
  }, extra);
  const out = wp(`echo wp_json_encode( wt_create_web_booking( json_decode( '${JSON.stringify(fields).replace(/'/g, "\\'")}', true ) ) );`);
  const j = JSON.parse(out);
  return j.booking ? j.booking.id : (j.errors ? JSON.stringify(j.errors) : out);
}
async function freeSlot(date, skip = 0) {
  const r = await signedWp('GET', '/wt/v1/connector/slots', { query: { city: 'lucknow', date, pkg: 'pkfull' } });
  const free = (r.b.slots || []).filter((s) => s.free);
  return free[skip] ? free[skip].start : null;
}
/** A desk action, retried like a person would when the booking changed a moment ago (409 from the revision check). */
async function deskAction(ref, body) {
  let r;
  for (let i = 0; i < 5; i++) {
    r = await signedWp('POST', `/wt/v1/connector/bookings/${ref}/action`, { body });
    if (r.s !== 409) return r;
    await sleep(1500);
  }
  return r;
}
const jobByRef = (ref) => sql(`select id||'|'||status||'|'||coalesce(partner_id::text,'')||'|'||coalesce(staff_flag,'')||'|'||coalesce(wp_rev::text,'') from bookings where wp_ref='${ref}'`).split('|');

(async () => {
  // ── Setup ─────────────────────────────────────────────────────────────────────
  console.log('Setup');
  sql(`update bookings set status='cancelled' where wp_ref is not null and status not in ('completed','cancelled')`);
  wp(`global $wpdb; $wpdb->query("UPDATE " . wt_table() . " SET status='Cancelled', data=REPLACE(data,'\\"status\\":\\"Confirmed\\"','\\"status\\":\\"Cancelled\\"') WHERE type='booking' AND (phone='${TEST_PHONE}' OR data LIKE '%\\"source\\":\\"App\\"%')");`);
  sql(`update partner_profiles set city='Lucknow', is_online=true, employment_type='freelancer', release_count=0 where user_id=(select id from users where phone='+919900001111')`);
  sql(`update partner_profiles set city='Lucknow', is_online=true, employment_type='team' where user_id=(select id from users where phone='+919900002222')`);
  sql(`update partner_profiles set city=null where user_id in (select id from users where phone in ('+919900003333','+919900004444'))`);
  sql(`delete from partner_ledger_entries where note like 'Commission on booking%' and booking_id in (select id from bookings where wp_ref is not null)`);
  const ritika = await login('ritika.sharma@wagpartner.in', 'Partner@123');
  const aman = await login('aman.verma@wagpartner.in', 'Partner@123');
  const admin = await login('admin@wagandtails.in', 'WagTails@123');
  check('logins work', ritika && aman && admin);
  const ritikaId = sql(`select id from users where phone='+919900001111'`);
  const amanId = sql(`select id from users where phone='+919900002222'`);
  await api(admin, 'POST', '/admin/wp/sync');

  // ── B2: website booking → job ─────────────────────────────────────────────────
  console.log('\nB2 website booking becomes a job');
  const d1 = ist(2);
  const s1 = await freeSlot(d1);
  const ref1 = websiteBooking(d1, s1);
  check('website booking created on the plugin', /^WT-/.test(ref1), ref1);
  let job = await waitFor(() => { const j = jobByRef(ref1); return j[0] ? j : null; });
  check('job created from the plugin message', job && job[1] === 'needs_partner', job);
  const jobId1 = job && job[0];
  check('customer matched or created by phone', sql(`select count(*) from users where phone='+91${TEST_PHONE}'`) === '1');
  check('pet snapshot + aggression on the job', sql(`select pet_breed||'|'||pet_aggression||'|'||channel from bookings where id='${jobId1}'`) === 'Golden Retriever|Mild — nervous with strangers|website');
  check('escalation time set', sql(`select escalate_at is not null from bookings where id='${jobId1}'`) === 't');
  await drainOutbox();
  let pb = await plugin(ref1);
  check('desk card shows "searching" with the job id', pb.job && pb.job.status === 'searching' && pb.job.id === jobId1, pb.job);
  check('second message about the same change is ignored (no duplicate job)', sql(`select count(*) from bookings where wp_ref='${ref1}'`) === '1');

  // Open jobs show website jobs with aggression
  const open = await api(ritika, 'GET', '/partner/jobs/open');
  const card = (open.b || []).find((j) => j.bookingId === jobId1);
  check('partner sees the website job with aggression and source', card && card.petAggression && card.source === 'Website', card || open.b);

  // ── B4: partner progress is written to the desk card ──────────────────────────
  console.log('\nB4 progress written back');
  let r = await api(ritika, 'POST', `/partner/jobs/${jobId1}/claim`);
  check('freelancer claims the job', r.s === 201 || r.s === 200, r.b);
  await drainOutbox();
  pb = await plugin(ref1);
  check('desk card: assigned with groomer name', pb.job.status === 'assigned' && /Ritika/.test(pb.job.partner && pb.job.partner.name), pb.job);
  check('WhatsApp "groomer assigned" attempted for the website customer', new RegExp('Ritika Sharma is your groomer for ' + ref1).test(wp(`echo wp_json_encode( wt_rec_list( 'notif', array(), 'id DESC', 30 ), JSON_UNESCAPED_UNICODE );`)));
  r = await api(ritika, 'PATCH', `/partner/jobs/${jobId1}/on-the-way`);
  check('on the way', r.s === 200, r.b);
  await drainOutbox();
  pb = await plugin(ref1);
  check('desk card: on the way + tracking link', pb.job.status === 'on_the_way' && /\/track\//.test(pb.job.trackUrl || ''), pb.job);
  const token = (pb.job.trackUrl || '').split('/track/')[1];
  r = await api(null, 'GET', `/track/${token}/data`);
  check('B7 tracking data works without login', r.s === 200 && r.b.status === 'partner_on_the_way' && /Ritika/.test(r.b.groomer && r.b.groomer.name), r.b);
  const page = await fetch(`${API}/track/${token}`);
  check('B7 tracking page is served', page.status === 200 && /Track your groomer/.test(await page.text()));
  check('B7 bad token refused', (await api(null, 'GET', '/track/not-a-real-token-123/data')).s === 404);
  check('WhatsApp "on the way" carries the start code', new RegExp(sql(`select start_otp from bookings where id='${jobId1}'`)).test(wp(`echo wp_json_encode( wt_rec_list( 'notif', array(), 'id DESC', 5 ) );`)));
  await api(ritika, 'PATCH', `/partner/jobs/${jobId1}/arrived`);
  await api(ritika, 'POST', `/partner/jobs/${jobId1}/before-photos`, { urls: ['https://example.com/before.jpg'] });
  r = await api(ritika, 'PATCH', `/partner/jobs/${jobId1}/verify-start`, { otp: sql(`select start_otp from bookings where id='${jobId1}'`) });
  check('start code accepted', r.s === 200, r.b);
  await drainOutbox();
  pb = await plugin(ref1);
  check('desk card: in progress', pb.job.status === 'in_progress', pb.job);
  r = await api(ritika, 'POST', `/partner/jobs/${jobId1}/collect-payment`, { method: 'cash' });
  check('cash collected', r.s === 200, r.b);
  r = await api(ritika, 'PATCH', `/partner/jobs/${jobId1}/complete`, { otp: sql(`select end_otp from bookings where id='${jobId1}'`), checklistItems: [], afterPhotos: ['https://example.com/after.jpg'] });
  check('job completed in the partner app', r.s === 200, r.b);
  await drainOutbox();
  pb = await plugin(ref1);
  check('plugin booking Completed, payment Cash', pb.status === 'Completed' && pb.payMode === 'Cash', { status: pb.status, payMode: pb.payMode });
  check('points credited by the plugin on completion', Number(wp(`echo wt_points_balance('${TEST_PHONE}');`)) > 0);
  check('freelancer owes commission (cash job)', Number(sql(`select coalesce(sum(amount),0) from partner_ledger_entries where booking_id='${jobId1}' and type='commission_due'`)) > 0);
  runQueue(); await sleep(1500);
  check('echo of our own write ignored (job still completed, once)', jobByRef(ref1)[1] === 'completed');

  // ── Desk changes flow back (B2) + reconfirm (B5) ──────────────────────────────
  console.log('\nDesk changes flow back');
  const d2 = ist(3);
  const ref2 = websiteBooking(d2, await freeSlot(d2));
  job = await waitFor(() => { const j = jobByRef(ref2); return j[0] ? j : null; });
  const jobId2 = job[0];
  await api(ritika, 'POST', `/partner/jobs/${jobId2}/claim`);
  await drainOutbox();
  const newStart = await freeSlot(d2, 2);
  r = await deskAction(ref2, { action: 'reschedule', date: d2, start: newStart, reason: 'Customer asked' });
  check('desk reschedule accepted by the plugin', r.s === 200, r.b);
  job = await waitFor(() => { const at = sql(`select to_char((scheduled_at at time zone 'UTC') at time zone 'Asia/Kolkata','HH24:MI')||'|'||coalesce(reconfirm_by::text,'') from bookings where id='${jobId2}'`); return at.startsWith(newStart) ? at : null; });
  check('job moved to the new time, partner must reconfirm', job && job.split('|')[1] !== '', job);
  r = await api(ritika, 'POST', `/partner/jobs/${jobId2}/confirm-time`);
  check('partner confirms the new time', r.s === 200 && sql(`select reconfirm_by is null from bookings where id='${jobId2}'`) === 't', r.b);
  r = await deskAction(ref2, { action: 'edit', price: 1500, reason: 'Extra service' });
  check('desk price change accepted', r.s === 200, r.b);
  job = await waitFor(() => sql(`select total from bookings where id='${jobId2}'`) === '1500.00');
  check('new price reaches the job', job);
  check('commission repriced for the partner', Number(sql(`select commission_amount from bookings where id='${jobId2}'`)) > 0 && Number(sql(`select commission_amount+partner_share_amount from bookings where id='${jobId2}'`)) === 1500);

  // ── P1 release (B5) ────────────────────────────────────────────────────────────
  console.log('\nRelease job');
  r = await api(ritika, 'POST', `/partner/jobs/${jobId2}/release`, { reason: 'Bike broke down' });
  check('partner releases the job', r.s === 200, r.b);
  job = jobByRef(ref2);
  check('job back to everyone, flagged released', job[1] === 'needs_partner' && job[2] === '' && job[3] === 'released', job);
  check('release counted on the partner', sql(`select release_count from partner_profiles where user_id='${ritikaId}'`) === '1');
  await drainOutbox();
  pb = await plugin(ref2);
  check('desk card shows the release flag', /Released/.test(pb.job.flag || ''), pb.job);

  // ── D1 desk assigns the team partner directly + B6 salaried ───────────────────
  console.log('\nDesk assign + team partner');
  r = await signedApi('GET', `connector/desk/partners?ref=${ref2}`);
  check('desk lists partners for the booking', r.s === 200 && r.b.partners.some((p) => p.id === amanId), r.b);
  check('desk refuses unsigned calls', (await api(null, 'GET', `/connector/desk/partners?ref=${ref2}`)).s === 401);
  r = await signedApi('POST', 'connector/desk/assign', { ref: ref2, partnerId: amanId, by: 'Anshika' });
  check('desk assigns the team partner', r.s === 200 && jobByRef(ref2)[2] === amanId, r.b);
  check('assignment clears the flag', jobByRef(ref2)[3] === '');
  await drainOutbox();
  pb = await plugin(ref2);
  check('desk card shows the new groomer', /Aman/.test(pb.job.partner && pb.job.partner.name), pb.job);
  // complete at the desk (12A): job closes, money recorded, no commission for a team partner
  r = await deskAction(ref2, { action: 'complete', mode: 'Cash', actor: 'Desk' });
  check('desk marks complete', r.s === 200, r.b);
  job = await waitFor(() => jobByRef(ref2)[1] === 'completed' ? jobByRef(ref2) : null);
  check('job closed by the desk completion', job && job[1] === 'completed', job);
  check('team partner: no commission owed', Number(sql(`select coalesce(sum(amount),0) from partner_ledger_entries where booking_id='${jobId2}'`)) === 0 && sql(`select commission_amount from bookings where id='${jobId2}'`) === '0.00');

  // ── Desk cancel ────────────────────────────────────────────────────────────────
  console.log('\nDesk cancel');
  const d3 = ist(4);
  const ref3 = websiteBooking(d3, await freeSlot(d3));
  job = await waitFor(() => { const j = jobByRef(ref3); return j[0] ? j : null; });
  await api(ritika, 'POST', `/partner/jobs/${job[0]}/claim`);
  await drainOutbox();
  r = await deskAction(ref3, { action: 'cancel', reason: 'Customer cancelled' });
  check('desk cancel accepted by the plugin', r.s === 200, r.b);
  job = await waitFor(() => jobByRef(ref3)[1] === 'cancelled' ? jobByRef(ref3) : null);
  check('desk cancel cancels the job', job && job[1] === 'cancelled', jobByRef(ref3));

  // ── B5 escalation ──────────────────────────────────────────────────────────────
  console.log('\nEscalation (waits for the 1-minute timer)');
  const d4 = ist(5);
  const ref4 = websiteBooking(d4, await freeSlot(d4));
  job = await waitFor(() => { const j = jobByRef(ref4); return j[0] ? j : null; });
  sql(`update bookings set escalate_at=now()-interval '1 minute' where id='${job[0]}'`);
  job = await waitFor(() => jobByRef(ref4)[3] === 'no_partner' ? jobByRef(ref4) : null, 75000, 3000);
  check('no partner in time → flagged for the desk', job && job[3] === 'no_partner', jobByRef(ref4));
  await drainOutbox();
  pb = await plugin(ref4);
  check('desk card: needs staff + "No groomer yet"', pb.job.status === 'needs_staff' && /No groomer/.test(pb.job.flag || ''), pb.job);
  check('desk alert sent (email/WhatsApp to the alert number)', /needs the desk/.test(wp(`echo wp_json_encode( wt_rec_list( 'notif', array(), 'id DESC', 8 ) );`)));

  // ── B3 app booking reserves the website slot first ─────────────────────────────
  console.log('\nB3 app bookings');
  const cust = await otpLogin('+919876543210');
  check('app customer logs in', !!cust);
  const custId = sql(`select id from users where phone='+919876543210'`);
  const petId = sql(`select id from pets where customer_id='${custId}' and species='dog' and is_active limit 1`);
  let addrId = sql(`select id from addresses where user_id='${custId}' and city='Lucknow' and pincode ~ '^[0-9]{6}$' limit 1`);
  if (!addrId) addrId = sql(`insert into addresses(user_id,label,line1,city,state,pincode,lat,lng,updated_at) values ('${custId}','Test','12 Hazratganj, Lucknow','Lucknow','UP','226001',26.85,80.94,now()) returning id`).split('\n')[0];
  const pkgId = sql(`select id from grooming_packages where wp_id='pkfull'`);
  const d5 = ist(3);
  r = await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${d5}&addressId=${addrId}`);
  check('slots come from the website', r.s === 200 && Array.isArray(r.b) && r.b.length > 0, r.b);
  const slotAt = r.b[0];
  r = await api(cust, 'POST', '/grooming/quote', { packageId: pkgId, addressId: addrId, petId, couponCode: 'PAMPER' });
  check('quote from the website (city price, coupon)', r.s === 201 && r.b.total === 1529.1 || (r.s === 201 && r.b.discount > 0), r.b);
  r = await api(cust, 'POST', '/bookings/grooming', { petId, packageId: pkgId, scheduledAt: slotAt, addressId: addrId, paymentMethod: 'cash_after_service' });
  check('app booking created', r.s === 201, r.b);
  const appId = r.b.id;
  const appRef = sql(`select wp_ref from bookings where id='${appId}'`);
  check('slot reserved on the website first (WT ref, source App)', /^WT-/.test(appRef), appRef);
  pb = await plugin(appRef);
  check('website record: App, Confirmed, priced by the website', pb && pb.source === 'App' && pb.status === 'Confirmed' && Number(pb.total) === Number(sql(`select total from bookings where id='${appId}'`)), pb);
  r = await api(cust, 'POST', `/payments/bookings/${appId}/pay-after-service`);
  check('pay after service confirms and looks for a partner', sql(`select status from bookings where id='${appId}'`) === 'needs_partner', r.b);
  // a second app booking at the same time, until the city capacity is full → SLOT_TAKEN
  let taken = null;
  const fillers = [];
  for (let i = 0; i < 4; i++) {
    const t = await api(cust, 'POST', '/bookings/grooming', { petId, packageId: pkgId, scheduledAt: slotAt, addressId: addrId, paymentMethod: 'cash_after_service' });
    if (t.s === 409) { taken = t; break; }
    if (t.s === 201) fillers.push(t.b.id);
  }
  check('a full slot is refused with SLOT_TAKEN', taken && taken.b.code === 'SLOT_TAKEN', taken && taken.b);
  for (const id of fillers) await api(cust, 'PATCH', `/bookings/${id}/cancel`, { reason: 'test filler' });
  // cancel from the app (more than 4 h ahead)
  r = await api(cust, 'PATCH', `/bookings/${appId}/cancel`, { reason: 'Plans changed' });
  check('customer cancels in the app', r.s === 200 || r.s === 204, { s: r.s, b: r.b });
  await drainOutbox();
  pb = await plugin(appRef);
  check('website record cancelled too', pb.status === 'Cancelled', pb.status);

  // online payment: slot held as Pending payment, confirmed after payment
  const slot2 = (await api(cust, 'GET', `/grooming/slots?packageId=${pkgId}&date=${ist(4)}&addressId=${addrId}`)).b[1];
  r = await api(cust, 'POST', '/bookings/grooming', { petId, packageId: pkgId, scheduledAt: slot2, addressId: addrId, paymentMethod: 'upi' });
  const payId = r.b.id;
  const payRef = sql(`select wp_ref from bookings where id='${payId}'`);
  check('online booking held as Pending payment on the website', (await plugin(payRef)).status === 'Pending payment');
  const order = await api(cust, 'POST', '/payments/orders', { bookingId: payId });
  const pid = order.b.payment && order.b.payment.id;
  r = await api(cust, 'PATCH', `/payments/${pid}/confirm`, { method: 'upi', providerPaymentId: 'pay_test', signature: 'mock' });
  pb = await plugin(payRef);
  check('after payment the website booking is Confirmed and Paid', pb.status === 'Confirmed' && pb.payStatus === 'Paid', { status: pb.status, pay: pb.payStatus, confirm: r.b });

  // ── Self-service cut-off (6A) ──────────────────────────────────────────────────
  sql(`update bookings set scheduled_at=now()+interval '2 hours' where id='${payId}'`);
  r = await api(cust, 'PATCH', `/bookings/${payId}/cancel`, { reason: 'late' });
  check('cancel inside 3 hours is refused (call the desk)', r.s === 403 && r.b.code === 'SELF_SERVICE_CLOSED', r.b);

  // ── B8 points and history; complaints ─────────────────────────────────────────
  console.log('\nB8 points, history, complaints');
  const webCust = await otpLogin('+91' + TEST_PHONE);
  check('website customer logs into the app with the same number (same account)', !!webCust && sql(`select count(*) from users where phone='+91${TEST_PHONE}'`) === '1');
  r = await api(webCust, 'GET', '/me/rewards');
  check('points from the website show in the app', r.s === 200 && r.b.points > 0, r.b);
  r = await api(webCust, 'GET', '/me/website-bookings');
  check('website bookings listed for the same phone', r.s === 200 && r.b.bookings.some((b) => b.ref === ref1), r.b);
  r = await api(webCust, 'POST', '/me/complaints', { booking: ref1, category: 'Haircut / style not as asked', text: 'The face trim was uneven on one side.' });
  check('complaint from the app reaches the website list', r.s === 201 && r.b.complaint && /^CM/.test(r.b.complaint.id), r.b);
  r = await api(webCust, 'GET', '/me/complaints');
  check('complaint visible in the app', r.s === 200 && r.b.complaints.length > 0, r.b);
  r = await api(cust, 'GET', '/config/booking');
  check('booking config from the website', r.s === 200 && r.b.connected && r.b.cities.length === 10 && r.b.aggression.length === 4, r.b);

  // ── 11A walking switch ─────────────────────────────────────────────────────────
  console.log('\nWalking switch');
  r = await api(cust, 'POST', '/bookings/walking', { petId, durationMinutes: 30, scheduleNow: false, scheduledAt: new Date(Date.now() + 26 * 3600000).toISOString(), addressId: addrId, paymentMethod: 'cash_after_service' });
  check('walk allowed in Lucknow (walking on)', r.s === 201, r.b);
  if (r.s === 201) {
    await drainOutbox();
    check('app walk recorded in the website walk list', /App · Booked/.test(wp(`echo wp_json_encode( wt_rec_list( 'walk', array(), 'id DESC', 3 ), JSON_UNESCAPED_UNICODE );`)));
  }
  sql(`update wp_cities set walking=false where id='lucknow'`);
  r = await api(cust, 'POST', '/bookings/walking', { petId, durationMinutes: 30, scheduleNow: false, scheduledAt: new Date(Date.now() + 27 * 3600000).toISOString(), addressId: addrId, paymentMethod: 'cash_after_service' });
  check('walk refused where walking is off', r.s === 422 && r.b.code === 'WALKING_NOT_AVAILABLE', r.b);
  sql(`update wp_cities set walking=true where id='lucknow'`);

  // ── P1 at the door + D1 desk routes inside the plugin ─────────────────────────
  console.log('\nAt the door, desk routes, settings');
  const d6 = ist(6);
  const ref6 = websiteBooking(d6, await freeSlot(d6));
  job = await waitFor(() => { const j = jobByRef(ref6); return j[0] ? j : null; });
  const jobId6 = job[0];
  const nf = JSON.parse(wp(`wp_set_current_user(1); echo wp_json_encode( wt_desk_list('nogroomer','all','') );`));
  check('desk filter "No groomer yet" lists the new booking', nf.list.some((b) => b.id === ref6));
  const viaDesk = wp(`wp_set_current_user(1); $r = wt_api_apps_assign(array('ref'=>'${ref6}','partnerId'=>'${ritikaId}')); echo is_wp_error($r) ? 'ERR '.$r->get_error_message() : 'OK';`);
  check('desk assigns through the plugin (signed call to the backend)', viaDesk === 'OK' && jobByRef(ref6)[2] === ritikaId, viaDesk);
  sql(`update bookings set scheduled_at=now()+interval '10 minutes' where id='${jobId6}'`);
  await api(ritika, 'PATCH', `/partner/jobs/${jobId6}/on-the-way`);
  await api(ritika, 'PATCH', `/partner/jobs/${jobId6}/arrived`);
  r = await api(ritika, 'POST', `/partner/jobs/${jobId6}/customer-not-available`, { photoUrl: 'https://example.com/door.jpg' });
  check('"customer not available" refused before waiting 15 minutes', r.s === 409 && r.b.code === 'WAIT_LONGER', r.b);
  sql(`update booking_status_history set changed_at=now()-interval '20 minutes' where booking_id='${jobId6}' and status='arrived'`);
  r = await api(ritika, 'POST', `/partner/jobs/${jobId6}/customer-not-available`, { photoUrl: 'https://example.com/door.jpg' });
  check('"customer not available" after waiting: desk flagged', r.s === 200 && jobByRef(ref6)[3] === 'customer_not_available', r.b);
  r = await api(ritika, 'POST', `/partner/jobs/${jobId6}/stop`, { reason: 'Dog is biting, not safe' });
  check('"stop job" flags the desk', r.s === 200 && jobByRef(ref6)[3] === 'stopped', r.b);
  await drainOutbox();
  pb = await plugin(ref6);
  check('desk card shows the stop reason', /stopped/i.test(pb.job.flag || '') && /biting/.test(pb.job.flag || ''), pb.job);
  wp(`$c = wt_config(); $c['settings']['appsCancelHours'] = 6; wt_save_config($c);`);
  await api(admin, 'POST', '/admin/wp/sync');
  r = await api(cust, 'GET', '/config/booking');
  check('settings from the website reach the apps (cancel cut-off 6 h)', r.b.selfServiceCutoffHours === 6, r.b.selfServiceCutoffHours);
  wp(`$c = wt_config(); $c['settings']['appsCancelHours'] = 3; wt_save_config($c);`);
  await api(admin, 'POST', '/admin/wp/sync');

  // ── Safety net poll + status ───────────────────────────────────────────────────
  r = await api(admin, 'POST', '/admin/wp/poll');
  check('catch-up poll runs', r.s === 201, r.b);
  r = await api(admin, 'GET', '/admin/wp/status');
  check('no failed writes to the website', r.s === 200 && r.b.outbox.failed.length === 0, r.b.outbox);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
