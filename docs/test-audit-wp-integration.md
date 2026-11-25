# Test audit: website + apps integration

Date of the audit run: 2026-11-21/22. Everything below ran against the **local** stack only (API on :3001, dev database `wag_postgres_dev`, staging WordPress on :8090). Nothing was run against the live site or the live database.

## How to run it
```
# PC terminal, project folder. Docker Desktop must be running.
docker compose -f infra/wp-staging/docker-compose.yml up -d
node apps/api/dist/apps/api/src/main.js        # the API (after: cd apps/api && npm run build)
cd apps/api
npm run test:e2e                                # 84 end-to-end tests, about 17 minutes
npx jest                                        # 30 unit tests
node ../../infra/wp-staging/tests/apps-integration-test.js   # 80-check apps link test (API running)
# stop the API first, then:
node ../../infra/wp-staging/tests/connector-test.js          # 49-check plugin test (needs port 3001 free)
```
`npx jest -c jest.e2e.config.js test/e2e/cleanup.e2e.ts` empties the staging calendar of test bookings.

## The test team (suites in `apps/api/test/e2e`, TypeScript)
| Suite | Role | Tests | What it attacks |
|---|---|---|---|
| `security.e2e.ts` | Security tester | 40 | A role/endpoint access matrix (anonymous, customer, partner, staff, admin on 14 endpoints), another customer's booking, another partner's job, no commission or KYC data to customers; forged, unsigned, replayed, stale, future-dated, wrong-method and tampered signed calls in both directions; desk and admin routes of the plugin against the public; the booking-verify leak; tracking links (guessing, leaks, headers); SQL/script input, malformed and oversized bodies, bad ids, hostile photo links, login brute force, hostile uploads |
| `concurrency.e2e.ts` | Race-condition tester | 11 | Two partners claiming one job, ten claims by one partner, desk assign against a claim, five identical website events at once, out-of-order events, a retried create, a points movement sent four times, parallel app bookings for the last slot, an app and a website customer for the last place, double-tapped payment collection and completion, parallel desk edits |
| `resilience.e2e.ts` | Chaos tester | 7 | The website stopped while a groomer works and customers book; writes arriving in order afterwards; a newer change made while an older write is still on its way; lost change messages; a write that can never succeed; a payment arriving after the held slot expired and was taken |
| `edgecases.e2e.ts` | Business-rule tester | 20 | Salaried team partner (no commission, dues, payout), freelancer commission, no partner discount on website prices, release then re-claim, reconfirm timer, chosen-partner fallback, running-late flag, cancel cut-off and "on the way" rules, moving to a full slot, price protection, points at checkout and on cancel, coupons, customer isolation, desk phone booking with a custom package, desk completion, desk cancel while on the way, desk assign/unassign rules, dues limit, desk edits while a groomer waits at the door |
| `load.e2e.ts` | Load tester | 5 | 100+100 simultaneous reads, 50 polling partners, 30 customers opening the date screen, a 300-request burst (rate limit), health afterwards |
| earlier suites | Regression | 80 + 49 + 30 | The apps link test (every flow row), the plugin test, unit tests |

Also: TypeScript checks of the API and all four apps; both mobile apps built into real Android bundles with every new screen inside; panel screens checked in a headless browser.

## What the audit found, and fixed
Real defects (each was reproduced by a test first, then fixed, then the test passed):

1. **Customers could see the partner's commission and internal desk fields** in their own booking (commission %, the partner's share, escalation timers, flags, the website revision, the public tracking token). Now stripped from every customer response.
2. **Points could be credited several times** when the same request overlapped itself (4 simultaneous requests with one key gave 4 × 40 points). The same race could create duplicate bookings. Idempotent writes now run one at a time per key (database lock).
3. **A slot could be over-booked**: six simultaneous app bookings all succeeded in a slot that holds three. The website's own booking form and the desk's add-booking had the same race. Booking, moving and paying now take a lock per city and day.
4. **Completing or advancing a job twice at once succeeded twice** (duplicate pushes and history). Each step now happens exactly once; the second tap gets "already done".
5. **A newer change could be lost** when an older write to a slow website was still on its way: the old write finished and marked the newer one as done. Reproduced by pausing the website. Fixed.
6. **"Customer not available" wait restarted** whenever anything was written while the groomer waited at the door (for example a desk price change).
7. **A signed event about a booking that does not exist made the backend answer 500** (the website then retried for ever). Now answered cleanly.
8. **A date out of range was reported as "slot taken"**, so the app would say the time was just booked. Now only a really taken slot gives that answer.
9. **A customer could "move" a booking to the time it already had**; the app accepted it, the website refused it, and the write failed for good. Now refused up front with a clear message.
10. **The apps' API client dropped the server's error codes**, so every check like "partner not available" or "photo required" never fired (found earlier, fixed in the previous round).

Mistakes in the tests themselves were also found and fixed (they would have hidden problems): capacity checks that counted with a wrong query and always passed, checks depending on leftover data, and dates outside the website's 10-day window. The test helpers now reset their own data.

## What is NOT covered (needs a person, or the real thing)
- **Phone screens** (customer and partner app) were typechecked and bundled but not tapped through on a phone. Checklist: `docs/qa-checklist-wp-integration.md`.
- **Real WhatsApp** (templates not yet approved by Meta), **real Razorpay**, **real push notifications** (mock providers locally), **real maps routing** for ETA.
- **The live site and VPS**: plugin upload, wp-config, hosting limits. Go-live steps and a smoke test: `docs/deploy-wp-integration.md`.
- **Production-size load**: the load test proves no errors and sensible latency on a laptop, not capacity planning.
- **Long-running behaviour** (weeks of timers, many thousands of bookings).
- **Browser compatibility** of the panel beyond Chrome.

## Round 2 (25 Nov 2026): everything in the plugin
New suites in `apps/api/test/e2e`: `panel.e2e.ts` (36 tests: signed-only access, partners, Aadhaar encryption and "Show" logging, approve/reject/suspend, staff vs owner money limits, payouts, support tickets, activity log, real WordPress role checks) and `store.e2e.ts` (21 tests: WooCommerce catalogue copy, quotes with coupon/shipping/COD, orders and online payment in WooCommerce, stock holds and the last-item race, partner price, late payments, insurance leads both ways). Full run: **141 e2e + 80 apps link + 49 plugin + 30 unit, all passing**; both mobile apps typecheck; the new plugin pages were checked in a headless browser.

Real defects found and fixed in this round:
1. The partner's own profile response included the new encrypted Aadhaar fields (now stripped everywhere).
2. A partner could read any store order by its id (only customers were restricted).
3. App store orders were never paid online: the checkout screens only labelled UPI/Card. Now the order is created in WooCommerce, then paid, with a "Pay now" button on the order page.
4. Two shoppers could both buy the last item (now one order at a time site-wide, and WooCommerce holds the stock for unpaid orders).
5. Shipping rules (free above an amount) ignored the cart in WooCommerce's REST context; now calculated with WooCommerce's own cart.

Not covered: phone screens (Aadhaar screen, checkout, order pay-now), real Razorpay, real WhatsApp, the live site.
