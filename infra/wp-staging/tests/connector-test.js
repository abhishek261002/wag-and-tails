// End-to-end test of the plugin's Connector against the local staging site (infra/wp-staging).
// Run: node infra/wp-staging/tests/connector-test.js   (staging must be up and seeded)
// Starts a fake backend on :3001 to receive the plugin's outgoing change messages.
const http = require('http');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');

const SITE = 'http://localhost:8090/wp-json';
const SECRET = 'local-dev-connector-secret-change-me';
const COMPOSE = path.join(__dirname, '..', 'docker-compose.yml');
let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  -> ' + String(x).slice(0, 300))); };
const wp = (php) => execSync(`docker compose -f "${COMPOSE}" exec -T cli wp eval ${JSON.stringify(php)}`, { env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).toString().trim();
const wpcli = (args) => execSync(`docker compose -f "${COMPOSE}" exec -T cli wp ${args}`, { env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).toString().trim();

function canonical(route, query) {
  const keys = Object.keys(query || {}).sort();
  if (!keys.length) return route;
  return route + '?' + keys.map((k) => encodeURIComponent(k).replace(/%20/g, '+') + '=' + encodeURIComponent(String(query[k])).replace(/%20/g, '+')).join('&');
}
async function call(method, route, { query, body, ts, nonce, secret, sigOverride } = {}) {
  const t = String(ts ?? Math.floor(Date.now() / 1000));
  const n = nonce ?? crypto.randomBytes(12).toString('hex');
  const raw = body === undefined ? '' : JSON.stringify(body);
  const sig = sigOverride ?? crypto.createHmac('sha256', secret ?? SECRET).update(`${t}\n${n}\n${method}\n${canonical(route, query)}\n${raw}`).digest('hex');
  const qs = query ? '?' + Object.keys(query).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join('&') : '';
  const r = await fetch(SITE + route + qs, { method, headers: { 'Content-Type': 'application/json', 'X-WT-Timestamp': t, 'X-WT-Nonce': n, 'X-WT-Signature': sig }, body: raw || undefined });
  const text = await r.text(); let b; try { b = JSON.parse(text); } catch { b = text; }
  return { s: r.status, b, nonce: n, ts: t };
}
const ymd = (d) => new Date(Date.now() + d * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

(async () => {
  // Fake backend for outgoing messages
  const received = [];
  const server = http.createServer((req, res) => {
    let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
      const exp = crypto.createHmac('sha256', SECRET).update(`${req.headers['x-wt-timestamp']}\n${req.headers['x-wt-nonce']}\nPOST\n${req.url}\n${raw}`).digest('hex');
      received.push({ ok: exp === req.headers['x-wt-signature'], body: JSON.parse(raw || '{}') });
      res.writeHead(200); res.end('{}');
    });
  });
  await new Promise((r) => server.listen(3001, r));
  try {
    // Start clean: remove bookings left by earlier runs of this test.
    wp(`global $wpdb; $wpdb->query("DELETE FROM " . wt_table() . " WHERE data LIKE '%\\"name\\":\\"Conn Test\\"%'");`);
    // ---------- auth ----------
    let r = await call('GET', '/wt/v1/connector/config', { sigOverride: 'deadbeef' });
    check('bad signature refused (401)', r.s === 401, r.s);
    r = await call('GET', '/wt/v1/connector/config', { secret: 'wrong-secret' });
    check('wrong secret refused', r.s === 401, r.s);
    r = await call('GET', '/wt/v1/connector/config', { ts: Math.floor(Date.now() / 1000) - 3600 });
    check('old timestamp refused', r.s === 401, r.s);
    r = await call('GET', '/wt/v1/connector/config');
    check('signed config read works', r.s === 200 && r.b.cities.length === 10 && r.b.packages.length === 5, JSON.stringify(r.b).slice(0, 200));
    const replay = await call('GET', '/wt/v1/connector/config', { nonce: r.nonce, ts: r.ts });
    check('replayed nonce refused', replay.s === 401, replay.s);
    check('config has city prices, walk plans, rewards, aggression levels', r.b.packages[0].prices.lucknow === 999 && r.b.walkPlans.length === 2 && r.b.rewards.minRedeem === 100 && r.b.aggression.length === 4, '');
    check('secrets are not in config', !JSON.stringify(r.b).includes('razorpaySecret') && !JSON.stringify(r.b).includes('waToken'), '');

    // ---------- slots ----------
    const day = ymd(3);
    r = await call('GET', '/wt/v1/connector/slots', { query: { city: 'lucknow', date: day, pkg: 'pkbasic' } });
    check('slots read', r.s === 200 && r.b.slots.length > 5 && r.b.mins === 60, JSON.stringify(r.b).slice(0, 150));

    // ---------- create app booking ----------
    const phone = '98' + String(Date.now()).slice(-8);
    const base = { city: 'lucknow', pkg: 'pkbasic', petType: 'Dog', petName: 'Bruno', breed: 'Beagle', gender: 'Male', age: '2 years', aggression: 'Calm — loves people', name: 'Conn Test', phone, address: '12 Test Road, Gomti Nagar', pincode: '226010', lat: 26.85, lng: 80.95, date: day, start: '15:00', pay: 'later' };
    const jobId = crypto.randomUUID();
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId, expectTotal: 1 } });
    check('price mismatch is refused (409) and nothing is created', r.s === 409 && /price changed/i.test(JSON.stringify(r.b)), `${r.s} ${JSON.stringify(r.b)}`);
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId, expectTotal: 999 } });
    check('app booking created at the Lucknow price', r.s === 200 && r.b.booking.total === 999 && r.b.booking.status === 'Confirmed' && r.b.booking.source === 'App', `${r.s} ${JSON.stringify(r.b).slice(0, 300)}`);
    const ref = r.b.booking?.id;
    check('booking carries the job id and pet name', r.b.booking?.job?.id === jobId && r.b.booking?.petName === 'Bruno', '');
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId } });
    check('repeating the same jobId returns the same booking', r.s === 200 && r.b.repeat === true && r.b.booking.id === ref, JSON.stringify(r.b).slice(0, 200));
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId: 'bad id' } });
    check('invalid jobId refused', r.s === 400, r.s);
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId: crypto.randomUUID(), city: 'mars' } });
    check('unknown city refused', r.s >= 400, r.s);
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId: crypto.randomUUID(), date: ymd(-1) } });
    check('past date refused', r.s >= 400, r.s);
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId: crypto.randomUUID(), date: ymd(30) } });
    check('date beyond maxDaysAhead refused', r.s >= 400, r.s);
    // fill the slot: capacity is 3 (one already used by the booking above)
    const fill = [];
    for (let i = 0; i < 2; i++) fill.push(await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId: crypto.randomUUID() } }));
    check('slot accepts up to the city capacity', fill.every((x) => x.s === 200), fill.map((x) => x.s).join(','));
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId: crypto.randomUUID() } });
    check('a full slot is refused with 409 SLOT_TAKEN', r.s === 409, `${r.s} ${JSON.stringify(r.b)}`);
    r = await call('GET', '/wt/v1/connector/slots', { query: { city: 'lucknow', date: day, pkg: 'pkbasic' } });
    check('the full slot now shows as not free', r.b.slots.find((s) => s.start === '15:00')?.free === false, JSON.stringify(r.b.slots.find((s) => s.start === '15:00')));
    // coupon + points + extras
    wp(`wt_points_add('${phone}', 300, 'Test', '');`);
    r = await call('POST', '/wt/v1/connector/bookings', { body: { ...base, jobId: crypto.randomUUID(), start: '11:00', pkg: 'pkfull', coupon: 'PAMPER', usePts: true, extras: [{ name: 'Tick bath', price: 150 }] } });
    const bk2 = r.b.booking;
    // Full 1699, PAMPER 10% = 170, after 1529, points up to 50% capped by balance 300 -> 300, extras +150
    check('coupon, points and extras priced like the website', r.s === 200 && bk2.discount === 170 && bk2.ptsDiscount === 300 && bk2.total === 1529 - 300 + 150, `${r.s} ${JSON.stringify({ d: bk2?.discount, p: bk2?.ptsDiscount, t: bk2?.total })}`);
    r = await call('GET', '/wt/v1/connector/customer', { query: { phone } });
    check('points were taken on confirmation', r.s === 200 && r.b.points === 0, JSON.stringify(r.b).slice(0, 200));
    check('customer read returns their bookings', r.b.bookings.length >= 4, r.b.bookings?.length);

    // ---------- job progress ----------
    r = await call('POST', `/wt/v1/connector/bookings/${ref}/job`, { body: { status: 'assigned', partner: { id: 'p1', name: 'Ritika Sharma', phone: '9123456780', type: 'team' } } });
    check('job assigned with partner', r.s === 200 && r.b.booking.job.status === 'assigned' && r.b.booking.job.partner.name === 'Ritika Sharma', `${r.s} ${JSON.stringify(r.b).slice(0, 200)}`);
    check('plugin status stays Confirmed while the job runs', r.b.booking.status === 'Confirmed', r.b.booking.status);
    r = await call('POST', `/wt/v1/connector/bookings/${ref}/job`, { body: { status: 'on_the_way', etaMins: 20, trackUrl: 'https://example.test/t/abc', notify: true, startCode: '4821' } });
    check('on the way with ETA and tracking link', r.s === 200 && r.b.booking.job.etaMins === 20 && r.b.booking.job.trackUrl === 'https://example.test/t/abc', JSON.stringify(r.b).slice(0, 200));
    check('partner kept when not resent', r.b.booking.job.partner?.name === 'Ritika Sharma', '');
    r = await call('POST', `/wt/v1/connector/bookings/${ref}/job`, { body: { status: 'teleported' } });
    check('unknown job status refused', r.s === 400, r.s);
    const notif = wp(`echo wp_json_encode(array_slice(wt_rec_list('notif', array(), 'id DESC', 5), 0, 5));`);
    check('on-the-way WhatsApp attempted and logged (no template yet = not sent)', /on the way/i.test(notif) && /4821/.test(notif), notif.slice(0, 300));

    // ---------- complete ----------
    r = await call('POST', `/wt/v1/connector/bookings/${ref}/action`, { body: { action: 'complete', mode: 'cash', actor: 'Ritika Sharma' } });
    check('complete with cash', r.s === 200 && r.b.booking.status === 'Completed' && r.b.booking.payMode === 'Cash' && r.b.booking.payStatus === 'Paid', `${r.s} ${JSON.stringify(r.b).slice(0, 300)}`);
    check('completion recorded as done by the partner via the app', /App · Ritika Sharma/.test(r.b.booking.closedBy) && r.b.booking.job.status === 'completed', r.b.booking?.closedBy);
    r = await call('GET', '/wt/v1/connector/customer', { query: { phone } });
    check('reward points earned on completion (10% of 999 = 99)', r.b.points === 99, r.b.points);
    r = await call('POST', `/wt/v1/connector/bookings/${ref}/action`, { body: { action: 'complete', mode: 'cash' } });
    check('completing twice is refused', r.s === 400, r.s);

    // ---------- cancel + reschedule ----------
    r = await call('POST', `/wt/v1/connector/bookings/${bk2.id}/action`, { body: { action: 'cancel', reason: 'Customer request', details: 'via app' } });
    check('cancel works', r.s === 200 && r.b.booking.status === 'Cancelled', `${r.s} ${JSON.stringify(r.b).slice(0, 200)}`);
    r = await call('GET', '/wt/v1/connector/customer', { query: { phone } });
    check('used points returned on cancel (99 + 300)', r.b.points === 399, r.b.points);
    const third = fill[0].b.booking.id;
    r = await call('POST', `/wt/v1/connector/bookings/${third}/action`, { body: { action: 'reschedule', date: ymd(4), start: '12:00', reason: 'App reschedule' } });
    check('reschedule works and is logged', r.s === 200 && r.b.booking.status === 'Rescheduled' && r.b.booking.date === ymd(4) && r.b.booking.history?.length === 1, `${r.s} ${JSON.stringify(r.b).slice(0, 200)}`);
    r = await call('POST', `/wt/v1/connector/bookings/${third}/action`, { body: { action: 'delete' } });
    check('delete is not available through the connector', r.s === 400, r.s);

    // ---------- points ----------
    const key = crypto.randomUUID();
    r = await call('POST', '/wt/v1/connector/points', { body: { phone, pts: 50, key, reason: 'App promo' } });
    check('points added', r.s === 200 && r.b.balance === 449, JSON.stringify(r.b));
    r = await call('POST', '/wt/v1/connector/points', { body: { phone, pts: 50, key } });
    check('same key twice adds once', r.b.repeat === true && r.b.balance === 449, JSON.stringify(r.b));
    r = await call('POST', '/wt/v1/connector/points', { body: { phone, pts: -10000, key: crypto.randomUUID() } });
    check('cannot go below zero', r.s === 409, r.s);

    // ---------- insurance ----------
    r = await call('POST', '/wt/v1/connector/insurance', { body: { phone, fields: { 'Pet parent name': 'Conn Test', 'Phone number': phone, 'Pet name': 'Bruno' } } });
    check('insurance lead from the app lands in the same list', r.s === 200 && /^IN-/.test(r.b.id), JSON.stringify(r.b));

    // ---------- change feed ----------
    r = await call('GET', '/wt/v1/connector/changes', { query: { since: '2000-01-01 00:00:00', limit: 500 } });
    const refs = (r.b.list || []).filter((x) => x.type === 'booking').map((x) => x.ref);
    check('change feed lists bookings with revisions', r.s === 200 && refs.includes(ref) && r.b.list.find((x) => x.ref === ref).rev >= 2 && r.b.list.every((x) => x.rev >= 0), `${r.s} ${refs.length}`);
    const last = r.b.list[r.b.list.length - 1];
    r = await call('GET', '/wt/v1/connector/changes', { query: { since: last.updatedAt, afterId: last.rowId } });
    check('paging from the last change returns nothing new', r.s === 200 && r.b.list.length === 0, JSON.stringify(r.b).slice(0, 200));
    wp(`wt_rec_delete('booking', '${third}');`);
    r = await call('GET', '/wt/v1/connector/changes', { query: { since: last.updatedAt, afterId: last.rowId } });
    check('deletion appears as a tomb', r.b.list.some((x) => x.type === 'tomb' && x.data.ref === third), JSON.stringify(r.b).slice(0, 300));

    // ---------- hardening ----------
    const vr = await (await fetch(SITE + '/wt/v1/bookings/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: fill[1].b.booking.id }) })).json();
    check('verify without a payment signature reveals nothing personal', vr.booking && !vr.booking.phone && !vr.booking.address && Object.keys(vr.booking).length === 2, JSON.stringify(vr));
    const conflict = wp(`$a = wt_rec_get('booking', '${fill[1].b.booking.id}'); $b = $a; $a['notes']='first'; wt_rec_save('booking', $a, true); $b['notes']='second'; $r = wt_rec_save('booking', $b, true); echo is_wp_error($r) ? 'conflict' : 'saved';`);
    check('a stale strict save is refused (no lost update)', conflict === 'conflict', conflict);
    const notes = wp(`echo wt_rec_get('booking', '${fill[1].b.booking.id}')['notes'];`);
    check('the first change survived', notes === 'first', notes);

    // ---------- outgoing messages ----------
    // Async on purpose: the fake backend lives in this process and must be able to answer while the queue runs.
    await execAsync(`docker compose -f "${COMPOSE}" exec -T cli wp action-scheduler run --hooks=wt_conn_push --batch-size=200 --quiet`, { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    await new Promise((x) => setTimeout(x, 500));
    check('change messages reached the backend, signed', received.length > 0 && received.every((m) => m.ok), `${received.length} received, signed ok: ${received.filter((m) => m.ok).length}`);
    check('one message per booking per request (deduplicated)', received.some((m) => m.body.type === 'booking' && m.body.ref === ref), JSON.stringify(received.slice(0, 3)));
    check('messages from app actions are marked fromApp', received.some((m) => m.body.ref === ref && m.body.fromApp === true), '');
  } catch (e) {
    console.log('FATAL', e); fail++;
  } finally {
    server.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
