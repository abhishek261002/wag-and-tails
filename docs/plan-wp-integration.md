# Build tracker: WordPress plugin + apps integration

Design: `docs/wordpress-admin-integration.md` (architecture) and `docs/booking-flows-integrated.md` (flows).
Approved 2026-11-18: all decisions in section 9 of the flows doc, option **A** (1A … 13A).
Tick a box only when built AND verified. Continue from the first unticked box.

## Decisions (approved)
1A offer to all eligible partners, first to accept, desk can assign · 2A escalation 2h / 6pm day before / 15 min same-day ·
3A app "Choose partner" kept, falls back to all · 4A website customers get groomer name + tracking link ·
5A start/end codes for website bookings via WhatsApp · 6A app cancel/reschedule free up to 4h before ·
7A no fees, desk decides · 8A My team = salaried (no commission split, no dues) · 9A same Razorpay account ·
10A points earn + spend in app · 11A walks app-only, plugin walking switch + prices · 12A desk complete allowed, money recorded ·
13A desk phone bookings auto-offered unless assigned.

## Notes and known constraints
- Plugin changes (v1.14.0): new `includes/connector.php`; small edits to `wag-and-tails.php` (DB v2: `rev` column + `type_updated` index), `records.php` (revisions, strict save, `wt_record_changed` hook), `bookings.php` (strict desk saves, verify leak fix, `$GLOBALS['wt_actor']`), `slots.php` (Meta signature), `config.php` (`waAppSecret`), `notify.php` (3 new WhatsApp events). Original copy for diffing: scratchpad `wp-plugin-original`.
- Connector signing: HMAC-SHA256(secret, `ts⏎nonce⏎METHOD⏎/wt/v1/connector/...?sortedQuery⏎body`) where ⏎ is a newline, headers X-WT-Timestamp / X-WT-Nonce / X-WT-Signature; outgoing events signed the same way over the URL path of WT_CONNECTOR_URL. Secret only in wp-config (`WT_CONNECTOR_SECRET`).
- Live-site deploy needs: `WT_CONNECTOR_SECRET` + `WT_CONNECTOR_URL` in wp-config.php, plugin upload, then any page load runs the DB upgrade.
- Tests: `node infra/wp-staging/tests/connector-test.js` (49 checks).
- New WhatsApp templates (groomer assigned, on the way + start code, end code) need Meta approval on the client's account before they send; until then they appear as "Not sent (no template)" in the Notifications log. The plugin already handles that gracefully.
- The plugin is client code we now maintain: keep changes in new files where possible, minimal edits to existing files, bump version.

### B1 notes (built 2026-11-18)
- Backend module `apps/api/src/wp/`: signed client (`wp-client.service.ts`, `wp-sign.ts`), config sync (`wp-config-sync.service.ts`, mapping in `wp-config-map.ts`), admin endpoints `GET /admin/wp/status`, `GET /admin/wp/cities`, `POST /admin/wp/sync`.
- Settings in `apps/api/.env`: `WP_CONNECTOR_URL` (site REST base, e.g. https://wagandtails.in/wp-json), `WP_CONNECTOR_SECRET` (= `WT_CONNECTOR_SECRET` in wp-config.php), optional `WP_CONNECTOR_TIMEOUT_MS` (default 30000). Both unset = integration off, apps work as before.
- Sync runs at start-up, every 5 minutes (skips when nothing changed), and on demand. Migration `20261118100000_wp_config_sync`: `wp_cities`, `grooming_package_city_prices`, `wp_sync_state`, `grooming_packages.wp_id/duration_minutes`, `coupons.source`.
- What it does: website cities replace `SERVICE_CITIES`; website packages (matched by plugin id) with services and per-city prices, packages not on the website are hidden; website coupons (source `wp`, grooming only), removed ones switched off, a code that already exists as an app coupon is skipped with a warning; walk prices by length (others switched off); reward rules kept for B8.
- `GET /grooming/packages?city=<name or id>` returns that city's website prices (packages the website does not price there are left out).
- While the integration is on, our panel refuses edits to package prices/services, new packages, walk prices and website coupons (409 `MANAGED_BY_WEBSITE`); our own package description stays editable.
- Tested: 10 unit tests (`src/wp/wp.spec.ts`) + live against staging: first sync, city prices (Mumbai uplift), a price change, coupon added/removed, coupon name clash, walking switch, walk price change, edit guards, website down (error recorded, data kept, recovers), unchanged scheduled sync. Connector test still 49/49.
- Left for later steps: booking prices still use the package base price until B3 (app bookings priced by the plugin); the walking switch is stored but not yet enforced (B3/A1); a GPS address in "Mumbai" or "Pune" does not match the website's split cities (North/South/Navi Mumbai, Pune/PCMC), so A1 must let the customer pick the website city; staging WordPress on Windows Docker is slow (0.5-20 s per call), hence the 30 s timeout and one retry for reads.

### B2-B8 notes (built 2026-11-18)
- New backend files in `apps/api/src/wp/`: `wp-link.ts` (phones, India time, escalation deadlines, job status), `wp-outbox.service.ts` (queued writes with retries; the website's answer is reconciled in full, so desk changes made meanwhile are never skipped), `wp-jobs.service.ts` (job progress to the desk card, actions, timers), `wp-ingest.service.ts` (plugin messages + 2-minute poll → jobs), `wp-bookings.service.ts` (slots, quote, reserve, paid, points, complaints, app walks), `wp-desk.service.ts` (desk partner list, assign/unassign, live map), controllers `wp-connector.controller.ts` (signed plugin calls), `wp-customer.controller.ts`, `track.controller.ts`.
- Migration `20261118120000_wp_jobs`: booking link fields (`wp_ref`, `wp_rev`, `wp_source`, `wp_city_id`, `wp_status`, `pet_aggression`), escalation/flags (`escalate_at`, `escalated_at`, `staff_flag*`, `reconfirm_by`, `late_flagged_at`, `no_show_photo`), `track_token`, `partner_profiles.release_count`, `wp_outbox`, booking channel `website`.
- Plugin additions (connector.php): `awaitPay` hold on app bookings, `bookings/{ref}/paid`, `quote`, `walks`, `complaints` (GET/POST), desk alert on `alert` (new WhatsApp event `job_alert_admin`, needs Meta approval like the other three); `wt_current_customer_phone()` honours the backend acting for an app customer.
- Rules: website/desk bookings become jobs offered to partners (customer = phone number, pet and address created or matched); desk reschedule/price/cancel/complete flow into the job; partner progress, codes and tracking link flow to the desk card and (website customers only) WhatsApp; app bookings reserve the website slot first (online payments hold it 20 min as "Pending payment"; if the hold lapsed and the slot went, the payment is refunded); app self-service cancel/move up to 4 h before (`APP_SELF_SERVICE_CUTOFF_HOURS`); escalation per 2A (1-minute timer), chosen-partner fallback to everyone (3A), reconfirm within 2 h after a reschedule, running-late flag, pay-later bookings the app never confirmed are confirmed after 10 min; team partners salaried (no commission/dues/payout); website-priced jobs never get partner discounts; our staff panel refuses phone bookings while connected (made on the WordPress desk instead).
- New partner endpoints: `POST /partner/jobs/:id/release`, `/confirm-time`, `/customer-not-available` (after `NO_SHOW_WAIT_MINUTES`, default 15, with a photo), `/stop`.
- New customer endpoints: `GET /config/booking`, `POST /grooming/quote`, `GET /me/rewards`, `GET /me/website-bookings`, `GET|POST /me/complaints`; `GET /grooming/slots` accepts `cityId` and `bookingId` and returns the website's free slots; `POST /bookings/grooming` accepts `usePoints`, `expectTotal`, `cityId`.
- Public tracking page: `/api/v1/track/<token>` (link in the "on the way" WhatsApp; base from `PUBLIC_API_URL` or `API_URL`).
- Tested: `node infra/wp-staging/tests/apps-integration-test.js` (73 checks, needs the API running on :3001) and the plugin test (49, needs :3001 free). Unit tests 30.

### P1, A1, D1, D2, Z1 notes (built 2026-11-18)
- Partner app: job screen shows source/WT ref, a Temperament box, the real commission split (or "Salaried"), a "booking was moved" reconfirm banner, and "Problem with this job?" (release before arriving, customer not available with a door photo, stop job); cards show date, source, aggression, "Confirm new time"; list refreshes on desk events.
- Customer app (when connected): pet → address (website city check, area chooser for Mumbai/Pune, pincode) → package with city prices → add-ons → website slots (`WebsiteSlotPicker`) → note → review with the website's quote, coupon and **Use my points**; SLOT_TAKEN / PRICE_CHANGED handled; reschedule uses website slots and the cut-off; Account → Reward points, Website & phone bookings, Complaints (with photos); "Report a problem" on completed bookings for 24 h. Old flow unchanged when not connected.
- Shared API client: `website` API, city-aware packages and slots, and errors now keep the server's `code` (before this fix, every `err.response.data.code` check in the apps never matched).
- Plugin panel: `includes/apps.php` (desk routes signed to the backend: partners, assign, unassign, live; settings with limits; desk filters), desk card groomer chip + Assign/Change groomer, filters No groomer yet / Running late / In progress now / Needs attention, admin **Apps & partners** page (live map, partner panel link, rules). Rules sync to the backend (`appRules()` in `wp-link.ts`).
- Verified: apps link test 80/80, plugin test 49/49, unit 30/30, typechecks of API and all four apps, panel screenshots in headless Chrome (desk, assign window, Apps & partners). Phone screens still need a person: `docs/qa-checklist-wp-integration.md`. Go-live steps: `docs/deploy-wp-integration.md`.

### Test audit (2026-11-21/22)
Full audit with 84 TypeScript end-to-end tests (`apps/api/test/e2e`, `npm run test:e2e`), found and fixed 9 real defects (customer saw commission data, double-credited points, over-booked slots, double step execution, a lost newer write on a slow website, door-wait clock restart, 500 on unknown event, wrong "slot taken", no-op reschedule). Report and how to run: `docs/test-audit-wp-integration.md`. Final state: e2e 84/84, link test 80/80, plugin test 49/49, unit 30/30, all typechecks clean, both mobile apps bundle.

## Phase 0: staging
- [x] S1 Docker WordPress + MySQL + WooCommerce + plugin (mounted from /wp-plugin), WP-CLI setup script
- [x] S2 Sample data: config (10 cities), desk staff, customers, bookings, products

## Phase 1: plugin hardening
- [x] H1 `bookings/verify` no longer leaks booking details
- [x] H2 Revision counter on bookings (no lost updates) + `updated_at` index
- [x] H3 Meta webhook signature check

## Phase 2: Connector (plugin)
- [x] C1 Signed server-to-server auth (HMAC, timestamp, secret from wp-config)
- [x] C2 Read: config, slots, bookings changed since, customer by phone (+ points, history)
- [x] C3 Write: create booking (idempotent), job status updates, assign partner, complete with payment, cancel, reschedule, points earn/spend, insurance/complaint leads
- [x] C4 Outgoing events on booking/customer/lead change, queued with retries
- [x] C5 New booking fields: partner, jobStatus, source App, external job id; new WhatsApp events

## Phase 3: backend
- [x] B1 Plugin client + config sync (cities, city prices, coupons, rewards, walking switch)
- [x] B2 Ingest plugin bookings → linked jobs (idempotent), offer to partners
- [x] B3 App bookings reserve plugin slot first, then job
- [x] B4 Write job progress/payment/completion back to plugin
- [x] B5 Escalation timers + desk alerts; release job; customer not available; reconfirm after reschedule
- [x] B6 Team partners salaried (no commission/dues)
- [x] B7 Public tracking page + start/end codes for website bookings
- [x] B8 Points and history from plugin for app customers

## Phase 4: partner app
- [x] P1 Website jobs + aggression/pet notes, release job, customer not available, reconfirm

## Phase 5: customer app
- [x] A1 Plugin slots + city prices, points at checkout, website history, cancel/reschedule rule, complaints

## Phase 6: panel
- [x] D1 Desk card: groomer, live status, source; Assign/change groomer; filters
- [x] D2 Apps and partners section (embedded screens + live map); new settings

## Z: verify
- [x] Z1 End-to-end on staging for every flow row; QA checklist; deploy plan
