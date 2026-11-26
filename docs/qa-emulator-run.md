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
