# Emulator test run: customer app, partner app, plugin panel

Date started: 26 Nov 2026. Tester: Claude, on the Android Studio emulator (Android 14, x86_64).

**What is tested**
- Customer app and partner app: the existing EAS **preview** APKs built 26 Nov 2026 at 16:44 (commit 8a42c15).
- Backend: the VPS, https://api.wagandtails.in. Mock SMS, mock payments, mock KYC.
- Website side: the staging clone, https://wagandtails.in/yamato (admin panel = the plugin).

**Known before starting** (these builds are older than two later changes)
- K1. Partner sign-up: after DigiLocker the phone shows "Unmatched Route". Fixed in code (`app/kyc.tsx`), not in this APK.
- K2. Partner login may still show the old "Test accounts" box. Removed in code, not in this APK.

**Result key:** PASS / FAIL / BLOCKED / N/A. Each FAIL gets a bug id (B1, B2...) in the Bugs section at the bottom.

Test data: every record made here is prefixed "QA " so it can be deleted afterwards.

---

## A. Customer app

### A1. First start and login
- [ ] A1.1 App opens, no crash, splash then login
- [ ] A1.2 Enter a phone number, receive the mock OTP ("Dev OTP" shown)
- [ ] A1.3 Wrong OTP shows a clear error; 3-4 wrong tries do not lock the app forever
- [ ] A1.4 Right OTP logs in; first-time user reaches register (name etc.)
- [ ] A1.5 Kill the app and reopen: still logged in
- [ ] A1.6 Log out and in again

### A2. Home, pets, addresses
- [ ] A2.1 Home loads (banners, services, no blank sections)
- [ ] A2.2 Add a dog (photo optional), edit it, view it
- [ ] A2.3 Add a cat
- [ ] A2.4 Vaccines, medical record, notes screens open and save
- [ ] A2.5 Add an address (map picker / search works with the Ola key)
- [ ] A2.6 Edit and delete an address

### A3. Grooming booking
- [ ] A3.1 Select pet, package, add-ons, address, date/time, groomer note, review
- [ ] A3.2 Prices match the website (city price list, from the plugin)
- [ ] A3.3 A slot already taken is not offered / shows a clear message
- [ ] A3.4 Pay online (mock) and pay later: both end on the confirmed screen
- [ ] A3.5 Booking appears in the plugin booking desk, source "App"
- [ ] A3.6 Booking detail screen, reschedule, cancel
- [ ] A3.7 Coupon applies; invalid coupon shows an error

### A4. Walking booking
- [ ] A4.1 Select dog, duration, schedule, summary
- [ ] A4.2 Searching screen, then partner assigned (needs an approved partner)
- [ ] A4.3 Live walk screen

### A5. Store (WooCommerce)
- [ ] A5.1 Store tab lists the WooCommerce products with images and prices
- [ ] A5.2 Product detail, variants, add to cart, cart totals
- [ ] A5.3 Checkout: address, shipping rate from WooCommerce, quote total
- [ ] A5.4 Pay online (mock); order appears in WooCommerce as `wag-app`
- [ ] A5.5 COD only when enabled in WooCommerce
- [ ] A5.6 Order list and detail, status change in WooCommerce reaches the app
- [ ] A5.7 Out-of-stock item cannot be bought

### A6. Account, support, extras
- [ ] A6.1 Profile edit
- [ ] A6.2 Reward points, offers, notifications
- [ ] A6.3 Website bookings (history from the site) and complaints
- [ ] A6.4 Support ticket: create, reply, appears in the plugin App support page
- [ ] A6.5 Insurance request: submit; appears in the plugin; status change comes back
- [ ] A6.6 Dr. Woof chat and history, vets screen
- [ ] A6.7 Terms and privacy open
- [ ] A6.8 Chat with the partner (messaging) on a booking

---

## B. Partner app

### B1. Sign-up and approval
- [ ] B1.1 Sign-up form validation (email, password, phone, age, city, role)
- [ ] B1.2 DigiLocker step (known issue K1 expected)
- [ ] B1.3 Aadhaar number and photos upload (all 3 tool photos for a groomer)
- [ ] B1.4 Pending-approval screen shows the right state
- [ ] B1.5 Partner appears in the plugin Partners list; Aadhaar number hidden until "Show", Show is logged
- [ ] B1.6 Approve in the plugin; partner can log in and sees jobs
- [ ] B1.7 Reject, suspend, reactivate behave correctly in the app

### B2. Jobs
- [ ] B2.1 Jobs tab, job offer notification, accept / decline
- [ ] B2.2 Start trip, navigate screen, arrived, start code, grooming, end code, collect cash, complete
- [ ] B2.3 Status shows on the plugin booking desk at each step
- [ ] B2.4 Problem buttons (customer not at home, release job)
- [ ] B2.5 Walk job screen
- [ ] B2.6 Schedule tab, earnings tab, payouts shown

### B3. Account
- [ ] B3.1 Working hours, service city, service radius
- [ ] B3.2 Documents, tools, reviews, terms
- [ ] B3.3 Support tickets
- [ ] B3.4 Partner store: browse, cart, checkout with partner discount, order list

---

## C. Plugin panel (staging site, in a browser)

- [ ] C1 Dashboard numbers match the backend
- [ ] C2 Connection to the apps card says Working; both sync buttons work
- [ ] C3 Booking desk: assign, change groomer, cancel; app updates
- [ ] C4 Partners page: filters, approve (city + My team/Freelancer), reject, suspend, Aadhaar Show / delete
- [ ] C5 Partner money: commission, discounts, dues, payout batch, mark paid, owner-only rules for staff
- [ ] C6 App support tickets: reply, status, escalate
- [ ] C7 Pet insurance leads
- [ ] C8 Customers lookup by phone
- [ ] C9 Activity log shows the actions above
- [ ] C10 Staff login sees only what staff may see; owner sees everything

---

## D. Cross-cutting
- [ ] D1 Push notification arrives on a job offer
- [ ] D2 Airplane mode / offline: friendly errors, no white screens
- [ ] D3 Back button behaviour on every flow
- [ ] D4 Rotate / small screen: nothing cut off
- [ ] D5 Slow network
- [ ] D6 No debug text, mock hints or localhost URLs visible in release builds

---

## Bugs

| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B1 | Customer home banner (`app/(tabs)/home.tsx:190`) | Banner advertises "20% off your first groom, code FIRST20". The code does not exist: the app says "This coupon code is not valid". The banner is hard-coded text. | High (misleads customers) | open |
| B2 | Customer bookings list vs detail | Same booking shows `#D0C8CBB0` in the list (first 8 chars of the id) and `#E2C96D7F` in the detail, confirmed screen and support (last 8 chars). Support cannot match them. | Medium | open |
| B3 | Booking timeline (`payments.service.ts:180`) | A pay-after-service booking shows "Payment confirmed" when it is sent to partners. Nothing was paid. | Low (wording) | open |
| B4 | Backend `wp-ingest.service.ts:336` | First website update to an app booking (e.g. after a reschedule) is treated as "address changed on the desk": false timeline entry, address text becomes "..., Lucknow, Lucknow", a new address record may be created, and an assigned partner gets a "Job updated" push. | High | open |
| B5 | Customer walking, duration screen | 45-minute walk shows "..." instead of a price and can be selected; booking then fails with "Walk pricing not found for this duration". Options without a price must be hidden. | Medium | open |
| B6 | Customer walking | Dog walking is offered on Home and goes through every step, then fails at the end with "Dog walking is not available in Lucknow yet." (the plugin's per-city walking switch is off). Should be said at the start. | Medium | open |
| B7 | Customer cart (`app/store/cart.tsx:57`) | Cart row shows "Product" and a bag icon instead of the item name, size and photo. The API sends `productName` / `variantName` / `imageUrl`; the screen reads `item.product.name`. Partner cart is fine. | High | open |
| B8 | Customer, after "Find Instantly" booking | `router.replace('/(tabs)/home')` leaves the booking wizard screens underneath: Android Back from Home/Account walks back into Note for Groomer, Add-ons, Date picker of a booking that was already placed (risk of a double booking). | Medium | open (confirm again after fix) |
| B9 | Customer Home on cold start | For a moment shows "there" and "Add your first pet" to a returning user before the data arrives. | Low | open |
| B10 | Customer Account "Payment methods" and Partner Account "Bank Account" | Rows that do nothing when tapped (`onPress={() => {}}`). Hide or build. | Low | open |
| B4b | Customer saved addresses | Result of B4: duplicate address "From website - QA Flat 12, Gomti Nagar, Lucknow" with a blank city ("Lucknow,  226010"). | Medium | open (same fix as B4) |
| M1 | Customer address map | Map tiles are blank in the emulator (pin and search work). Probably emulator GPU; verify on a real phone. | ? | needs real phone |
| D1 | Data on staging site | Customers are shown ~10 coupons worth ₹349 to ₹599 off (PRA...) on a ₹900 groom. Check these are meant to be public. | Business data | ask client |
| D2 | Data on staging site | "Full Grooming Package" shows "1 service included"; home says "From ₹999" while Basic Grooming is ₹900. | Low | ask client |


### More findings

| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B11 | Customer "Our vets" (`src/data/vets.ts`) | Two invented doctors with ratings and fees were shown. | High (fake people) | fixed in code, page now only says "coming soon" |
| B12 | Both apps, Help & support | Call / WhatsApp number `+91 80 6677 8899` is hard-coded and looks like a placeholder. | High before launch | **needs the real number from the client** |
| B13 | Customer vaccine form | "Other" appears twice in the vaccine list. | Low | fixed in code |
| B14 | Customer Home | Hard-coded strip "4.9 avg rating, 12k+ grooms done, 98% on time, 2 vets". Invented numbers. | High (false claims) | strip removed in code. The text "ID checked, police verified" is still there: client must confirm it is true |
| B15 | Both apps, every photo upload | Aadhaar photos, tool photos, profile photo all fail with "Network Error" on Android. The backend accepts the same file (checked with curl, HTTP 201). Cause: files are appended to the upload as a Blob; React Native only understands `{uri, name, type}`. | **Critical** (partner onboarding cannot finish) | fixed in code (`packages/api-client/src/multipart.ts`), **not yet verified on a phone: needs a new build** |
| K1 | Partner sign-up | Reproduced on the emulator: after DigiLocker the "Unmatched Route" page shows and "Go back" lands on login, losing the form. | Critical | fixed in code (`app/kyc.tsx`), needs new partner build |
| K2 | Partner login | Old build still shows "Test accounts" with demo emails and a password. (Those accounts do not exist on the live backend, checked: "Invalid credentials".) | Medium | fixed in code, needs new partner build |
| C1 | VPS setting | Dr. Woof says "isn't connected yet": `GEMINI_API_KEY` is not set on the VPS. | Config | open |

### Fix status after this pass (all in code, none shipped yet)
- Backend (needs a push and a VPS deploy): B3, B4 (with a unit test).
- Apps (needs new EAS builds): B1, B2, B5, B6, B7, B8, B9, B10, B11, B13, B14, B15, K1, K2.
- Not code: B12 (real support number), C1 (AI key), D1 and D2 (website data), M1 (check the map on a real phone).

### What passed on the emulator
Customer: first start, OTP login (wrong and right code), registration with a pet, home, add/delete-free address with search, grooming booking end to end (pay after service) incl. price from the website, invalid coupon message, reschedule, booking detail and timeline, store list, quote with shipping, WooCommerce order (#WC828, paid online mock), account screens (profile, addresses, rewards, website bookings, complaints, notifications, support, terms, privacy), pet detail, care note, Dr. Woof screen.
Partner: login error for wrong credentials, sign-up form and validation, DigiLocker mock (backend side), pending-approval screen with the Aadhaar and tools steps.

### Not tested yet (needs the website admin panel or a real phone)
- Approving the QA partner in the plugin (needs the staging admin login), so: partner jobs, accept, start trip, codes, complete, earnings, partner store, and the partner seeing the customer's QA booking.
- Plugin pages (section C) and the partner/customer chat, push notifications and live walk tracking.
- Anything after a photo upload (blocked by B15 on this build).
- Payments with a real provider, real SMS, real DigiLocker.


## Round 2: new builds (26 Nov, evening)

Installed the rebuilt customer and partner APKs on the emulator (both made after the first round of fixes).

### Confirmed fixed on the new builds
- **B15 photo upload:** customer profile photo uploaded; the backend has `/uploads/user_me_...jpg` (the old build gave "Network Error").
- **K1 DigiLocker return:** the `wagandtailspartner://kyc?...` link now lands on the "Become a partner" screen, no "Unmatched Route".
- **K2:** the "Test accounts" box is gone from the partner login.
- **B9:** the customer Home no longer flashes "Add your first pet" while loading.
- Partner: approved partner logs in, goes online, sees the booking (after a pull to refresh), claims it. The payout panel shows total 900, platform fee 20% (180), earnings 720. Correct.

### New bugs found in round 2
| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B16 | Partner Jobs | Rating is hard-coded "4.8" for every partner, even one with no reviews. | High (false number) | fixed in code: real average, "New" if no reviews |
| B20 | Partner job screen | The customer's "Note for groomer" and the notes saved on the pet profile never appear. The backend sends both; the screen only read an old snapshot field. | **High** | fixed in code |
| B21 | Partner, after "I'm on my way" | Screen crash "Something went wrong". Cause: map error "`id` cannot be changed" when the real route replaces the dashed estimate line. Also affects the customer's live tracking map. | **Critical** | fixed in code (layer keys in `LiveMapView.tsx`) |
| B22 | Both apps, every map | Map tiles return HTTP 401: Ola needs `api_key` on every request but its style only has it on the first one. The blank map in the address picker (earlier called M1, "maybe the emulator") was this. Checked against Ola: no key = 401, with key = 200. | **Critical** | fixed in code (`mapsKey.ts`, request transform) |
| B17 | Partner Jobs | Pressing Online does not refresh the open-jobs list: it says "0 near you" until you pull down. | Medium | open |
| B18 | Partner Jobs | "Today's schedule" also lists jobs on later days (a Saturday job showed under Today). | Low | open |
| B19 | Partner Jobs | Placeholder text on the login screen is the demo email ritika@wagpartner.in; sign-up placeholders look like real data (Ritika Sharma, +919900001111, 28). | Low | open |
| B2b | Booking address | The earlier false "address changed" bug had already stored "Lucknow, Lucknow" on this test booking. The backend fix stops new ones, it does not repair old rows. | Info | n/a for new data |

### Still to verify after the next build
Everything after "I'm on my way": navigate screen with map, arrived, start code, end code, collect cash, complete, earnings; customer live tracking; the real address map; partner Aadhaar/tool photo uploads; partner sign-up end to end; partner store; messaging.


## Round 3: development build + live code (27 Nov, night)

Switched to development builds: the apps load their code live from the PC, so fixes are tested in seconds without a rebuild.

### Confirmed on the emulator
- **B22 map tiles:** real Ola street maps now draw in the customer address picker and the partner job screen.
- **B21 crash:** "I'm on my way" and the job map no longer crash.
- **B20 notes:** the groomer sees "Note from the customer" and the pet's care notes.
- **B16 rating:** shows "New" for a partner with no reviews.
- **B2 booking number:** list and detail show the same number (#E2C96D7F).
- **B15 uploads in the partner app:** before-photo and after-photo upload fine.
- **The whole partner job runs end to end:** accept, on the way, arrived, before-photo, start code (wrong code is refused), after-photo, collect cash (confirm dialog), end code, slide to complete. The customer gets "Payment received", the booking becomes completed, the partner's Earnings show collected 900 / yours 720 / company 180 / commission due 180 against a limit of 1500.

### New bugs found and fixed in round 3
| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B23 | `SlideToComplete` (partner) | **A partner could never finish a job.** The slider is created once and kept the first-render values of `disabled` (true, the end code is empty then) and of the "complete" action. Sliding did nothing. | **Critical** | fixed, verified |
| B24 | `SlideToComplete` | The fill bar animated `width` with the native driver: "Style property 'width' is not supported by native animated module". Could crash the screen when a job is completed in a release build. Also the slider stayed stuck on "Done" after a wrong code. | High | fixed, verified |
| B25 | Customer "Rate & Review" | The button opened `/booking/rate`, a screen that did not exist (it loaded forever as a booking called "rate"). The backend also had **no way to create a review**: customers could never rate a partner, partner ratings and the partner Reviews screen could never fill. | **Critical** | built: screen `booking/rate.tsx`, `POST/GET /bookings/:id/review`, rating recalculated from all reviews. Screen verified; **submit needs the backend deploy** |
| B26 | Customer booking detail | A partner with no reviews showed "5 ★" (database default). Now "New", or "4.8 ★ (12)". | Medium | fixed |
| B27 | Partner job error text | Every failure to complete said "Incorrect code" (even network errors). | Low | fixed |

### Still open
- B17 (Online does not refresh the list), B18 and B24b: a completed job stays under "Today's schedule" / "Jobs left" until refreshed; "Today's schedule" also lists later days.
- **Push notifications are not configured**: both apps log "Unable to get Firebase Messaging instance". Needs a Firebase project and a `google-services.json` for each app before launch. Job offers rely on push.
- After-photos are kept only on the phone until the job is completed; leaving the job screen loses them.
- B12 support phone number, B14 "police verified" wording, GEMINI key (done by user), D1/D2 website data.


## Round 4: after the backend deploy (27 Nov, night)

### Confirmed
- **Customer review works end to end (B25):** 5 stars + comment sent from the app; saved; the partner's rating became 5.0 with 1 review; a second review of the same booking is refused (409); rating 9 is refused (400). The partner's Jobs screen shows 5.0, Account > Reviews shows the comment.
- **Partner Jobs list (B17/B18):** the finished job leaves "Jobs left" (now 0), the list is renamed "Your jobs", and it reloads when you return to the screen and when you go online.
- **Partner store order #WC830** placed with a delivery address added in the app.

### New bugs found and fixed in round 4
| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B28 | Backend, completed-jobs counter | Nothing ever counted finished jobs: partner "0 jobs completed" forever (also on the customer's booking page, the "choose a partner" sort and the plugin Partners list). | Medium | fixed in `commission.service.ts` (counted once per job, undone if the settle claim is released). **Needs the backend deploy.** Existing partners stay at their old number. |
| B29 | Partner Account / Reviews wording | "1 reviews"; a new partner showed a default "5.0". | Low | fixed |
| B30 | Partner store checkout | **A partner could never place a store order.** The "add an address" button only showed a message pointing to a screen that did not exist. | **High** | fixed: the address (map pin) screen was added to the partner app and the checkout reloads after saving |

### Open / for the client
- Partner discount % in the plugin is 0, so partner prices equal normal prices (shop shows "Trade Pricing" with the same number).
- Push notifications (Firebase) still not configured.


## Round 5: full sweep (27 Nov, early morning)

### Verified working on the emulator (new code, live)
- **Partner sign-up end to end:** form, DigiLocker (goes out and comes back with the form intact, "Aadhaar verified as QA Walker XXXX 1234"), submit, pending screen, Aadhaar front and back photo upload, number with checksum, consent, saved. (K1 and B15 fully confirmed.)
- **Customer:** support ticket (create, reply, photo attachment), pet insurance request, complaint (CM-4N4MZVN), store cart with real names, COD order #WC832, UPI order #WC828, dog-walk screens (no unpriced option; "not available in Lucknow yet" shown up front), second grooming booking, Back no longer re-enters the booking steps (B8), live tracking with route and ETA, two-way chat with the partner, reward points (180 after two grooms).
- **Backend:** completed-jobs counter now counts (1 after the next job; 2 jobs in earnings); earnings 2 jobs / 1800 / 1440 / 360 due.

### New bugs found and fixed in round 5
| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B31 | Both apps, 19 screens | On Android the keyboard covered the text box in tickets, chats, Dr. Woof, forms (only iPhone had keyboard handling). | **High** | fixed (padding on every platform) |
| B32 | Customer + partner chat and ticket screens | Photos sent in a chat or ticket showed as an empty block (relative `/uploads/..` link was not resolved). | High | fixed |
| B33 | Backend partner registration | A partner typing 10 digits was stored differently from customers' "+91...": duplicate accounts possible and the website could not match the number. | Medium | fixed (needs deploy) |
| B34 | Both carts | "Subtotal (1 items)" for 2 units. | Low | fixed |

### Needs the client / you
- **Dr. Woof** still says "isn't connected yet": the Gemini key is not on the VPS (copy command not run yet).
- **Approve "QA Walker"** (qa.walker2@example.com) in the plugin to test the walker side.
- In-app notification list holds only payment notices; "assigned / on the way / completed" rely on push (Firebase) and the website's WhatsApp templates.
- Partner discount % = 0 in the plugin; PRA coupons visible to everyone; support phone number; "police verified" claim.
- Plugin panel pages not checked (need the staging admin login).

### QA test data on the VPS/staging to delete before go-live
Customer +919000000101 (QABuddy, 2 bookings WT-45Y215U and WT-4MSACRA, store orders #WC828 #WC830 #WC832, ticket, complaint CM-4N4MZVN, insurance lead), partners qa.groomer1@example.com and qa.walker2@example.com.


## Round 6: remaining flows, security sweep, offline (27 Nov, day)

### Verified working on the emulator
- Cash booking timeline reads "Sent to partners (pay after service)" on the live server (B3 confirmed).
- Partner screens load without errors: schedule, working hours, service city, documents, tools, store orders, support, terms.
- Partner "I can't do this job": the booking goes back to "needs partner" and the release is counted.
- Customer cancel booking, profile email edit.
- Add a cat: breed list, cat vaccines, 15 kg weight limit, no Walk button, grooming flow up to packages, remove pet.
- Offline: notice appears, Store, Pets and Bookings offer a retry, the notice clears by itself on reconnect.
- Backend unit tests: 36 of 36 pass. Both apps and the API typecheck.

### Security holes found and fixed (all backend, need the deploy)
| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| S1 | `GET /bookings/:id/history` | Any logged-in user could read any booking's timeline. Reproduced with two QA accounts. | **Critical** | fixed, needs deploy |
| S2 | `POST /messaging/conversations` | Any logged-in user could open any booking's chat. A newly assigned partner could not chat, and the removed one stayed in it. | **Critical** | fixed, needs deploy |
| S3 | Walk partner search | Another customer's walk could be sent to partners. | High | fixed, needs deploy |
| S4 | Walk location update | GPS points could be written into another partner's walk. | High | fixed, needs deploy |
| S5 | Customer booking timeline | Showed the partner's name and private reason for releasing a job. | High (privacy) | fixed, needs deploy |

### Other bugs found and fixed in round 6
| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B35 | Partner, Account > Documents | This upload still failed on Android (it did not use the shared upload fix). Nobody can view these uploads anywhere, and the screen said "Aadhaar not submitted" when it was submitted. | High | upload fixed; menu row hidden |
| B36 | Both apps, 10 more screens | The keyboard covered the text box (job release reason, checkout, complaints, support and others). | High | fixed |
| B37 | Open jobs | A released job was offered back to the partner who released it. | Medium | fixed, needs deploy. The live popup can still appear, but claiming is refused. |
| B38 | Both apps, no internet | Nothing said the phone was offline. Offers showed "No active offers", Home told an existing customer to "Add your first pet", Pets said "No pets yet". | High | fixed |
| B39 | Customer, after adding or removing a pet and other finished steps; partner after finishing or releasing a job | Android Back opened a second, old copy of the tabs. | Medium | fixed |
| B40 | Pet pictures | A cat without a photo showed a dog drawing. | Medium | fixed (partner "your jobs" cards need the deploy) |
| B41 | Customer Home | Did not reload when you came back to it: a removed pet stayed on screen. | Medium | fixed |
| B42 | Grooming packages | "View more (1 services)". | Low | fixed |

### Still open
- Push notifications (Firebase) are not set up. This blocks launch.
- On a slow connection some inner screens (addresses, booking pet picker, orders, reviews) briefly show an empty list before the data arrives.
- Dr. Woof: the server was still replying "isn't connected yet" when last asked (command given to update the server settings).
- Ask the client: cats are offered the same grooming packages and prices as dogs. Is that intended?
- Walker flows: waiting for "QA Walker" approval and walking switched on for a city in the plugin.
- Plugin pages: need the staging admin login.
- Not confirmed: that the customer's cancellation reached the website booking desk.

### Extra test data
Booking WT-5EA9LDW (released, then cancelled). The test cat "QAMia" was removed in the app. The customer's email is now qa.customer@example.com.

## Round 6b: partner app re-check
| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B43 | Partner Earnings, no internet or failed load | Every amount showed ₹0, which reads as lost money. | High | fixed, verified offline and after reconnecting |
| B44 | Partner Earnings and Schedule | Loaded once and did not update until the app restarted. | Medium | fixed |
| B45 | Partner Jobs, Grooming tab | The selected tab's icon was brown on brown (invisible). | Low | fixed, verified |
| B46 | Partner Earnings labels | "Total Earned ₹0" sat under "Your share ₹1440"; these boxes only cover money the company pays out. | Medium | relabelled "Paid out", "Payout pending", "Company owes you (online payments)" |

Verified: the partner app loads with all round 6 changes, shows the offline notice and clears it on reconnect.

## Round 7: live-website comparison (27 Nov, afternoon)

### Checked on the live server after the round 6 deploy (commit 18201e6)
- Dr. Woof answers (model gemini-3.5-flash-lite).
- S1 and S2: another account now gets 403 for a booking's history and chat; the owner still gets 200.
- S5: the customer timeline says "We are finding you another partner."

### Compared with wagandtails.in
- Store: all 138 products have the same price and MRP in the app. None missing, none extra.
- Grooming packages: every package is "Dogs & cats" on the website, so cats and dogs pay the same. No change.
- Partner discount: the live website has no partner discount (its plugin has no such setting). Kept at 0%.
- Support: call +91 73077 69104, WhatsApp +91 63936 16359, info@wagandtails.in, 9 am to 7 pm every day.
- "Police verified" wording: confirmed true by the client, kept.

### Bugs found and fixed
| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B47 | Both stores | Only 20 of 138 products could ever be seen (also per category and search): the apps never asked for page 2. Missed in earlier store tests. | **Critical** | fixed (both stores verified loading past 20 by scrolling); stable sort needs the deploy |
| B48 | Coupons | The app listed 12 "PRA" codes (up to ₹599) as eligible. The website does not show them and every one fails with "This coupon code is not valid". The app server ignored coupon visibility. | **High** | fixed, needs the deploy; the next 5-minute sync applies it |
| B49 | Both product pages | No product photo; "0 (0 reviews)"; partner page said "0% below retail". | High | fixed |
| B50 | Partner store | Said "Trade Pricing / exclusive partner prices" although partners pay the website price. Now shows website price and MRP; partner wording returns only if a discount is set in the plugin. | Medium | fixed |
| B51 | Both apps, contacts | Placeholder phone +91 80 6677 8899 and unlisted email addresses. | High | replaced with the website's contacts |

### Go-live blocker
The live site runs plugin **1.16.0**; this repo has **1.15.0** (built from 1.14.0). Live has careers/job applications, a collections report, desk customer search and an insurance report that our copy lacks. Installing our zip on the live site would remove them. See the warning at the top of docs/deploy-wp-integration.md.

### Questions for the client
- Cancellation: the website policy says free up to **3 hours** before; the apps say and enforce **4** (plugin setting "appsCancelHours").
- PRA codes: if customers should be able to use them, set them to "Shown to customers" in the plugin; the website and apps will then both show them.
- PAMPER says "first booking" but a returning customer still gets it.

## Round 8: plugin 1.16.0 (live) merged with the app connection, now 1.17.0

- Three-way merge from the original 1.13.0. Only version numbers and two "both added here" spots clashed; both additions kept.
- All 26 PHP files pass a PHP 8.2 syntax check. No duplicate PHP functions, REST routes or JavaScript names.
- Local test site: 1.17.0 active, app connection test 49/49, all 36 admin screens open in Chrome with no script errors, careers / collections / customer search / insurance report respond, no PHP errors logged.
- Expected on the local site only: app screens say the apps server cannot be reached (it was not running), and two WhatsApp screens ask for a Business Account ID.
- Not run: the 80-check apps integration test (needs the app server and a local database). Not yet installed on /yamato.
- Upload file: infra/vps/wag-and-tails.zip (rebuild with `py -3 infra/vps/build-plugin-zip.py`).

## Round 9: end-to-end on /yamato with plugin 1.17.0 (27 Nov, afternoon)

- /yamato runs 1.17.0: its app.js is identical to the repo, 126 routes, careers jobs back, unsigned app-connection requests get 401, PRA600 refused.
- Driven through the live app server with the QA accounts (API level, not by tapping the apps).

| Journey | Result |
|---|---|
| 1. Book, groomer accepts then drops, customer cancels | 14/14. Website took the slot and freed it after the cancel. Dropped job not offered back. |
| 2. Full grooming job | 24/24. Chat, live status, photos, start/end codes, cash, earnings, review, website awarded 81 points for WT-5LLRHMZ. |
| 3. Store and website data | 11/11. COD order #WC836, changed-price refusal, points, website bookings, complaints, Dr. Woof. Insurance request listed. |
| 4. Full dog walk (walking on in Lucknow, QA Walker approved) | 24/24. Prices 199/349, dispatch, accept, codes, live location, UPI, photo, earnings, review. The "another account" dispatch check only used a non-customer account. |

| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B52 | Customer, after-walk screen | "Submit Review & Pay (+Rs 100 tip)": the server ignores tips, so nothing was charged or stored. | **High** | tip section removed; button says "Submit review"; seen on the emulator |
| B53 | Customer, after-walk screen | "Route 1.8 km" was typed into the code; photo area was a fixed placeholder. | High (false data) | distance removed; shows the walk's real photos |

Not covered: plugin admin screens on /yamato (no admin login), push notifications, real phone, real SMS / payments / DigiLocker, tapping through the walk screens in both apps.

Extra test data: WT-5L9LTVW and WT-5LKAAO4 (cancelled), WT-5LLRHMZ (completed), walk FCC5604D (completed), order #WC836. QA Walker approved; walking switched on for Lucknow on /yamato.

## Round 10: staff panel, 3-hour cancellation, Firebase push, new preview builds (27 Nov, afternoon)

- Staff panel (local test site, 1.17.0, temporary staff account; not on /yamato): all 7 screens open with no errors; 31/31 desk actions pass through the staff API; owner-only actions refused. Staff can read partner money, as agreed on 25 Nov.
- Apps integration test: 80/80 (local site + local server). It needs JWT_EXPIRES_IN longer than the run (used 3h): the run is slow on this PC and the 15-minute login expired mid-test on the first try.
- Free cancellation is 3 hours in the app text and in the server and plugin defaults. The live server still enforced 4 on 27 Nov: set "App customers can cancel or move up to (hours before)" to 3 in the plugin on /yamato.
- Preview builds (commit b3daaf5): both contain Firebase project wag-and-tails-5f87d; partner has the woof sound.
- **Push works end to end**: customer "Payment received" and partner "New grooming job" (job-requests channel, dog bark) arrived on the emulator.

| # | Where | What happens | Severity | Status |
|---|---|---|---|---|
| B54 | Server notifications | The booking/job type was replaced by 'system', so a tapped notification opened the inbox, not the booking or job. | **High** | fixed with 4 unit tests; needs deploy |
| B55 | Partner app | Every new job alerted twice (server push plus an old local stand-in). | High | local one now only when push is unavailable; needs new build |
| B56 | Both apps | Notification icon was a blank circle. | Low | white logo icon added; needs new build |
| B57 | Customer app | Walk notifications did not open the booking. | Medium | fixed; needs new build |
| B58 | Walk-complete message | "Great job today!" was sent to the customer. | Low | reworded; needs deploy |

Customer release build smoke test: login, home, notification permission, notifications screen, add-pet breed picker. Partner: login, jobs screen, channels. Other screens were not re-tapped in the release builds.

Extra test data: push-test bookings (one completed, one cancelled) for QABuddy.
