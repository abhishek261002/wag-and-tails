# Roadmap: partner KYC, cats, CSV import, partner discounts, partner dispatch, notifications, live navigation

Status: planning complete, execution in phase order below. Written 2026-09-21.

## 0. Assumptions (defaults I will build with unless you veto them)

| # | Question | Default used |
|---|----------|--------------|
| A1 | Aadhaar verification | **Decided: DigiLocker redirect flow.** Partner is sent to DigiLocker, verifies there, and returns to the app. Needs a DigiLocker requester registration (client id/secret, callback URL); a mock provider is used until then. |
| A2 | Partner discount | **Decided:** the percentage a partner offers customers on the service price, applied when that partner claims the job, valid only inside a staff-activated window. Commission split is per partner (see Phase 4). |
| A3 | Cats | Same packages and prices as dogs for now. Packages get an `applicableSpecies` field so admin can restrict or price separately later. All groomers receive cat jobs; a `petSpecies` capability on the partner profile lets staff turn that off per partner. |
| A4 | "Last vaccination is mandatory" | The date is required. A checkbox "Not vaccinated yet" is allowed as an explicit answer (puppies/kittens), and such pets get reminder nudges. |
| A5 | Targeted request (choose a partner) | Partner has 15 minutes for scheduled grooming/walks. On reject or timeout the customer is notified with three choices: pick another partner, send to everyone, or cancel. Instant walks stay broadcast-only. |
| A6 | Maps | Ola Maps for routing + tiles and `@maplibre/maplibre-react-native` for the native map. Needs a one-time **development build** (not Expo Go and not a production release); after that it hot-reloads like normal. The navigation UI also runs in the browser via the web map so it can be previewed without a device. |
| A7 | CSV/Excel match key | New `Product.sku` (unique). Rows with an existing SKU update the product, others create. |

Decisions I need from you are only the credentials/choices in A1, A6 and (if you disagree) A2. Nothing else blocks work.

## 1. Cross-cutting production standards (apply to every phase)

- **Migrations**: additive and backward compatible only (nullable columns or defaults, backfill in the same migration, never drop in the same release). One migration per phase. Tested on a scratch DB copy first.
- **Environments**: separate dev / staging / prod Supabase projects. `DATABASE_URL` for prod must be the IPv4 pooler (session mode) so it works from any host.
- **Validation**: every new endpoint gets a DTO with class-validator; reject unknown fields. Money as `Decimal`, never float.
- **Security**: role guards on every route; ownership checks (customer owns pet/booking, partner owns job); rate limits via `@nestjs/throttler` on OTP, upload, import and chat endpoints; audit-log every staff/admin write.
- **PII**: never store a full Aadhaar number (see Phase 2). Photos are EXIF-stripped, size-capped, MIME-checked.
- **Concurrency**: every state transition is a conditional `updateMany` with an expected current status, so two requests cannot both win.
- **Idempotency**: booking creation, claim, import commit and reminder sends are idempotent (unique keys).
- **Tests**: service-level Jest tests for each phase's state machine and edge cases; typecheck of all 6 packages must be clean; API smoke script per phase.
- **Feature flags** (env): `KYC_PROVIDER`, `ENABLE_PARTNER_SELECTION`, `ENABLE_NAVIGATION`, `ENABLE_REMINDERS` so any phase can be switched off in prod without a redeploy of the apps.
- **Observability**: structured logs with booking/partner ids, Sentry on API and both apps, `/health` covers DB.
- **Rollback**: each phase lists its rollback (flag off; migration is additive so no data loss).

## 2. Phase order and why

1. **Pets: species + mandatory last vaccination** (self-contained, other phases depend on species and vaccination data)
2. **Partner onboarding: role choice + DigiLocker Aadhaar verification**
3. **Dispatch: Find anyone / choose partner / past partners, race-safe claim, before-photo gate**
4. **Commission model, partner discounts, pay-after-service dues and commission limit**
5. **Product CSV/Excel import**
6. **Notifications: in-app, push, vaccination reminders, care tips**
7. **Live navigation (Zomato-style)** (largest, needs native build and provider keys)

---

## Phase 1: cats and mandatory last vaccination

**Data**: `enum PetSpecies { dog cat }`; `Pet.species` default `dog` (backfills all existing pets); `CoatType += hairless`; `Booking.petSpecies` snapshot; `GroomingPackage.applicableSpecies String[]` default `{dog,cat}`; `PartnerProfile.petSpecies String[]` default `{dog,cat}`. Last vaccination is stored as a `PetVaccination` row (name defaults to the species core vaccine, `expiryDate` defaults to +1 year, editable) plus `Pet.vaccinationStatus` (`recorded | not_vaccinated_yet | unknown`) so "unknown" legacy pets are distinguishable.

**API**: create/update pet requires `species`; requires `lastVaccinationDate` (not in the future, not before DOB) or `notVaccinatedYet=true`; breed validated against the species list; size derived from weight with species-specific thresholds (cat: <3.5 kg small, 3.5-6 medium, >6 large). `createWalkingBooking` rejects cats with `422 SPECIES_NOT_SUPPORTED`; grooming validates `package.applicableSpecies` and partner capability when a partner is targeted. Open-jobs query filters by partner `petSpecies`.

**Customer app**: add-pet flow step 0 is "Cat or dog" (two large tiles); breed dropdown and coat options switch by species; vaccination step is required (date picker with quick chips, optional vaccine name, "Not vaccinated yet"). Walking pet picker lists dogs only and explains "Cats are available for grooming only" when the customer only has cats. Existing pets without vaccination data show a "Add last vaccination" prompt on the pet card and the edit screen enforces it.

**Other surfaces**: partner job card shows species icon; staff/admin booking + customer pages show species; AI chat prompt and vaccine reminder logic become species-aware (dog: DHPPiL/Rabies/Kennel cough; cat: FVRCP/Rabies/FeLV).

**Edge cases**: pet species change after bookings exist (blocked once any booking exists), DOB after vaccination date, breed "Other/Mixed", cat weight missing, future-dated vaccination, timezone of "today" (IST), duplicate pet names, deleting pets with upcoming bookings (blocked).

**Acceptance**: cannot save a pet without species and vaccination answer; cat cannot be selected for walking in UI or API; existing dog data unchanged; both apps typecheck.

## Phase 2: partner onboarding, role choice, DigiLocker Aadhaar verification

**Decision (2026-09-21)**: verification is a redirect to DigiLocker, not an in-app OTP. The partner never types an Aadhaar number; DigiLocker authenticates them (Aadhaar-linked mobile + OTP happens inside DigiLocker), asks for consent, and sends them back to the app.

**Flow**: (1) basic details + photo + **role: Groomer / Walker / Both** (writes `modes`; cat-grooming toggle for groomers), (2) consent screen and "Verify with DigiLocker", (3) app opens the DigiLocker page in a secure in-app browser session, (4) DigiLocker redirects to our API callback, which exchanges the code, reads the verified identity, and redirects back to the app deep link, (5) the app shows "Aadhaar verified as <name>" and submits the application, creating the account with **Verification pending**. Staff review is unchanged (pending / approved / suspended / rejected).

**Server**: `POST /auth/partner/digilocker/start {consent}` -> `{requestId, authorizeUrl}` (state + PKCE code challenge stored on the request); `GET /auth/partner/digilocker/callback?code&state` (public, exchanges the code with the client secret, fetches name / DOB / gender / masked Aadhaar, stores them on the request, then 302s to `wagandtailspartner://kyc?requestId=...&result=ok|cancelled|error`); `GET /auth/partner/digilocker/status/:requestId` -> `{status, name, aadhaarLast4, kycToken}` once verified; `POST /auth/register/partner` still **requires** the `kycToken`, so no account can exist without verified identity.

**Provider abstraction**: `KycProvider` now has `buildAuthorizeUrl(state, codeChallenge)` and `exchange(code, codeVerifier)`. `mock` (dev) redirects straight to our callback and returns an identity from the sign-up name/age; `digilocker` calls the real Authorized Partner API (authorize / token / user / eAadhaar) using `DIGILOCKER_CLIENT_ID`, `DIGILOCKER_CLIENT_SECRET`, `DIGILOCKER_REDIRECT_URI`. Production refuses `mock`. **You need**: a DigiLocker "requester" registration (API Setu / MeriPehchaan) with our callback URL whitelisted, then those three values.

**Identity reference**: DigiLocker returns the Aadhaar masked, so duplicate detection uses an HMAC of the DigiLocker id (`digilockerid`) stored in `aadhaarRefHash` (unique: one person, one partner account) plus `aadhaarLast4`. No full Aadhaar number exists anywhere in our system.

**Guards**: `state` is single-use and expires in 15 min, PKCE verifier stays server-side, callback is idempotent, age >= 18 from the DOB DigiLocker returns, name similarity vs the entered name (mismatch flagged for staff, never auto-rejected), per-IP rate limit on `start`, daily cap, request rows purged after 24 h, deep-link result is only a hint (the app must fetch `status` with the requestId, which is unguessable and single-use).

**Staff/admin UI**: masked Aadhaar (XXXX XXXX 1234), "Verified via DigiLocker on <date>", verified name/DOB next to the entered ones, name-mismatch warning, KYC badge in lists.

**Edge cases**: user closes the browser tab (status stays `pending`, "Try again" button), denies consent (result `cancelled`), DigiLocker outage (clear retry message), account without Aadhaar linked in DigiLocker, wrong deep-link scheme on Android/iOS, app killed during the redirect (status endpoint recovers the state on relaunch), duplicate person, rejected partner re-applying, replayed callback.

**Acceptance**: mock provider end to end from the app; unverified registration returns 403/400; callback replay and state tampering rejected; real provider drops in via env once registered.

## Phase 3: dispatch options, race-safe claim, before-photo gate

**Data**: `Booking.assignmentMode (any | specific)`, `Booking.requestedPartnerId`; new `BookingPartnerRequest { bookingId, partnerId, status pending|accepted|declined|expired|cancelled, expiresAt, respondedAt, reason }` (also gives an audit trail for broadcast requests and lets a partner who declined never see that job again). No new `BookingStatus` values: `needs_partner` with a non-null `requestedPartnerId` means targeted.

**Customer checkout** (after date/time and address): three options
1. **Find anyone**: today's behavior, request goes to every eligible partner in the city.
2. **Choose a partner**: cards with photo, rating, review count ("New" when none), completed jobs, distance/ETA, next-slot fit; only eligible partners are shown (approved, not suspended, city, mode, species capability, working hours and no clashing booking at that slot).
3. **Past partners**: distinct partners from this customer's completed bookings of the same service, most recent first, with rating and "Book again"; greyed out with the reason if currently unavailable.

`GET /bookings/partner-options` returns `{available, past}`. Create-booking accepts `assignment: {mode:'any'} | {mode:'specific', partnerId}`.

**Partner side**: a targeted job shows only to that partner as a poll with countdown, Accept / Reject (reason optional). Open-jobs hides targeted jobs from everyone else and hides jobs the partner already declined.

**State machine**: Accept -> `assigned` (existing path, chat opens, start OTP generated). Reject or expiry (cron every minute, plus a DB `expiresAt` check on read) -> customer gets push + in-app + realtime event with the three fallback actions (pick another, send to everyone, cancel). Customer can also switch a still-pending targeted request to "everyone" at any time.

**Race fix (pre-existing bug)**: `claimJob` currently checks then updates. Replace with one conditional `updateMany` (`status needs_partner`, `partnerId null`, `requestedPartnerId null or me`, partner has no clashing booking) and treat `count 0` as "already taken".

**Before-photo gate**: new `POST /partner/jobs/:id/before-photos` (camera image, MIME/size-checked, EXIF stripped, max 10) appends to `Booking.beforePhotos` when status is `arrived`. `verifyStartOtp` returns `409 BEFORE_PHOTO_REQUIRED` unless at least one exists (grooming and walking). Partner UI: OTP box disabled until a photo is uploaded, with upload progress, retry and offline queue. Customer sees before photos on the booking timeline.

**Edge cases**: partner goes offline or is suspended after being targeted, partner double-booked between poll and accept, customer cancels/reschedules while pending, slot in the past on accept, two customers targeting the same partner for the same slot (first accept wins, second auto-expires with a message), partner declines then customer re-targets the same partner, staff manually assigns while a request is pending (cancels the request), wallet/coupon refunds on expiry-cancel, timezone handling.

**Acceptance**: concurrent claim test proves exactly one winner; targeted job invisible to other partners; start OTP rejected without a before photo; fallbacks reachable from push deep link.

## Phase 4: commission model, partner discounts, pay-after-service dues and the commission limit

Replaces the earlier "partner store discount" idea. Decisions from 2026-09-21:

**Partner discount** = a percentage off the *service price* that a specific partner offers customers (e.g. a newly joined partner gets 15% to win their first customers). It applies to a booking when that partner **claims the job**. Staff/admin create it per partner with a percent and a validity window and must activate it (activation is the approval); it can be updated or deactivated any time. Only one active discount per partner, history kept, admin-configurable ceiling (default 50%).

**Customer checkout**: two options, *Pay after service* or *Pay online*.
- **Choose-a-partner (Phase 3)**: the discount is known at checkout and shown ("Ritika offers 15% off").
- **Find anyone**: checkout shows the normal price with "Discount applies if your partner offers one". When a partner claims, the server re-validates that partner's discount (active, inside its window, approved) and recomputes the amount.
- *Pay after service*: the customer pays the recomputed final amount directly to the partner (cash/UPI). The amount shown to both sides updates on claim.
- *Pay online*: the customer pays up front; if the claimed partner has a valid discount the difference is refunded automatically (partial refund on the original payment method).
- All arithmetic is server-side; the client never sends a price. The booking snapshots `partnerDiscountPct`, `partnerDiscountAmount`, `commissionPct`, `commissionAmount`, `partnerShareAmount`.

**Commission split (per partner)**: each partner has a company commission % (e.g. 30 means 70/30, 20 means 80/20). Default comes from a platform setting; staff **and** admin can override it per partner. The split is applied to the amount the customer actually pays after the partner discount (assumption: the discount is shared proportionally; tell me if the partner or the company should bear it alone).

**Ledger**: a `PartnerLedgerEntry` table records every money movement per partner: `commission_due` (cash/UPI booking completed, company's cut is owed), `commission_paid` (partner paid the company), `payout_offset` (dues netted against an online-booking payout), `adjustment` (admin correction). Balance = commission due right now. Entries are unique per `(booking, type)` so completing twice cannot double-count.

**Commission limit**: platform setting (default 1500 INR, editable by super admin, optional per-partner override). When a partner's outstanding due reaches the limit:
- they see **no open jobs** and cannot claim or accept targeted requests (server-enforced, `403 COMMISSION_LIMIT_EXCEEDED`), and get a warning banner plus push explaining why;
- jobs already assigned can still be completed;
- they pay the due to the company in-app through Razorpay (payment order + confirmation creates `commission_paid`), or admin records an offline transfer;
- dues are also netted automatically against pending online-booking payouts, so a partner with online earnings is rarely blocked;
- an early warning fires at 80% of the limit.

**Earnings screen (partner app)**: total collected, "Your share" and "Company share" using their ratio (10,000 collected at 70/30 shows 7,000 / 3,000), commission due, limit progress bar, pay-now button, and per-booking breakdown.

**Staff and admin panels**: partner detail gets Commission (percent override), Discount (create / update / activate / deactivate / history) and Dues (balance, ledger, record offline payment). Staff can do all of it; admin additionally edits the platform default commission, the dues limit and the discount ceiling on the Settings page. Every change is audit-logged.

**Edge cases**: discount expires between checkout and claim, partner deactivated mid-window, booking cancelled or rescheduled after a discount was applied (recompute / reverse ledger), refunds and partial refunds, coupon + partner discount together (best-of, never stacked), partner suspended with dues, limit lowered by admin below current dues, rounding (paise, banker-safe integer arithmetic), concurrent completion, partner paid dues while a job poll is open.

**Acceptance**: 1,000 INR pay-after-service job at 15% discount and 70/30 split records 850 collected, 595 partner, 255 company due; crossing the limit hides jobs and blocks claim; paying dues restores jobs; online booking refunds the discount difference on claim.

## Phase 5: product import (CSV / Excel)

**Admin panel**: Products page gets "Import" and "Download template". Manual add/edit stays exactly as it is.

**Columns** (template): `sku` (required, unique key), `name`, `category` (matched by name/slug, created only if the "create missing categories" box is ticked), `description`, `mrp`, `retail_price`, `trade_price`, `image_urls` (pipe-separated), `tags`, `allergy_warnings`, `is_active`, and optional variant columns `variant_name`, `variant_sku`, `variant_mrp`, `variant_retail_price`, `variant_trade_price`, `variant_stock`. Also "Export current products" in the same format for round-tripping edits.

**Pipeline**: upload -> parse (CSV via `csv-parse`, Excel via `exceljs`, first sheet; not SheetJS, which has unpatched advisories) -> **dry-run preview** with per-row create/update/error counts and downloadable error report -> confirm -> transactional commit in chunks of 200 with an audit-log entry. Rows are idempotent by `sku`.

**Validation and limits**: 5 MB, 5,000 rows, UTF-8 (BOM tolerated), header names case-insensitive, currency symbols and thousands separators stripped, `trade_price <= retail_price <= mrp`, decimals to 2 places, duplicate SKUs inside the file rejected, a partially invalid file never half-imports (all-or-nothing by default, "skip invalid rows" as an option), formula/CSV-injection characters neutralised on export, admin-only and rate-limited.

**Acceptance**: 1,000-row file imports in one action; re-uploading the same file changes nothing; bad rows are reported with row numbers.

## Phase 6: notifications, push, vaccination reminders, care tips

- **Push**: implement the Expo push provider (`PUSH_PROVIDER=expo`) behind the existing `NotificationsService`; register tokens from both apps (customer app is missing the `expo-notifications` plugin), handle receipts and delete `DeviceNotRegistered` tokens, Android notification channels, deep links to booking / pet / support screens.
- **In-app**: notification types (booking, care tip, reminder, promo), unread badge, mark-all-read, per-category preferences (existing Notifications screen), and staff/admin can broadcast a care tip filtered by species/city.
- **Vaccination reminders**: a scheduler (`@nestjs/schedule`) runs daily at 10:00 IST: 30 days, 7 days, 1 day before expiry/due, on the day, then weekly while overdue (max 4). `ReminderLog` with a unique `(petId, kind, dueDate)` makes it duplicate-proof, and a DB advisory lock stops multiple API instances from double-sending. "Not vaccinated yet" pets get a gentle nudge at 8 weeks of age and then monthly. Respects preferences and quiet hours.
- **Care tips**: a small admin-managed library targeted by species/age; sent as in-app plus optional push, at most one per week per user.

**Acceptance**: a pet whose vaccine expires in 7 days produces exactly one push and one in-app entry; re-running the job produces none.

## Phase 7: live navigation (Zomato-style)

**Why the current map is not enough**: `LiveMapView` draws a dashed straight line between two points, has no routing, no turn instructions, no ETA, and the native path was never exercised.

**Server**: a `RoutingProvider` abstraction (Ola Maps Directions primary, OSRM fallback, straight line as last resort) with `GET /bookings/:id/route` returning polyline, distance, duration and turn-by-turn steps; cached ~30 s; ETA recomputed on partner movement and broadcast as `booking:eta_updated`. Location updates are validated against the partner's active booking and rate-limited; on-the-way positions are kept short-term (privacy) and purged.

**Partner app** (after "I'm on my way"): full-screen navigation with a heading-up camera following the rider, the route line, a next-manoeuvre banner (left/right/roundabout icon, distance, street name), remaining distance and ETA, voice prompts (`expo-speech`), automatic re-route when more than 50 m off route, a recenter button, customer address with call/chat, a "You're near, tap arrived" prompt inside 100 m (never auto-marks), screen kept awake, and an "Open in Google Maps" button as fallback.

**Customer app**: tracking screen like Zomato: partner marker moving smoothly along the route (interpolated between pings), consumed part of the route greyed, "Arriving in 7 min", camera fitted to both points, and a "Reconnecting..." state when pings are stale for over 30 s.

**Client stack**: `@maplibre/maplibre-react-native` with an Ola style so both platforms match (no Google Maps key), tiles/routing keys held server-side or in env, EAS dev-client builds, foreground location plus an Android foreground service while navigating.

**Edge cases**: GPS jitter (snap to route within 30 m), tunnels/loss of signal, app backgrounded, permission denied or "approximate only", low battery, no route found, customer address geocoding errors (partner can adjust the pin and the customer is asked to confirm), Ola quota/outage fallback, iOS/Android permission strings and Play Store background-location declaration.

**Acceptance**: rider sees turn banners and voice prompts on a simulated drive; customer marker glides along the road rather than jumping; ETA updates as the rider moves.

---

## 3. Testing matrix (per phase)

Unit/service tests for state machines and validators; concurrency test for claim; migration dry-run against a copy; API smoke script (curl) per phase; typecheck of api, staff-web, admin-web, customer-mobile, partner-mobile, ui packages; manual device pass for the mobile flows (list in each phase's acceptance).

## 4. Rollout

Feature flags default off in prod, phases released one at a time (1 -> 7), each after a staging soak. Backups (Supabase PITR) confirmed before Phase 2 and 5 migrations. Communications: app-store release notes, partner and staff briefings for Phases 2-4.

## 5. Known risks

- DigiLocker requester registration (government approval, callback URL whitelisting) can take time; legal review of consent text.
- Native map/navigation requires EAS builds and store review (background location declaration).
- Ola Maps quota and pricing must be confirmed before launch.
- Expo SDK 57 / React Native 0.86 package compatibility for MapLibre must be verified when adding the dependency.
