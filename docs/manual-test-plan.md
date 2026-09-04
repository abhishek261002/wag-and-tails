# Wag & Tails — Manual Test Plan

> **Date:** September 2026  
> **Version:** 1.0  
> Follow these steps in order after a fresh `docker compose up -d` and `npm run db:seed`.

---

## Seeded Test Accounts

| Role | Email | Phone | Password |
|------|-------|-------|----------|
| **Admin** | admin@wagandtails.in | +911234567890 | `WagTails@123` |
| **Staff** | staff@wagandtails.in | +911234567891 | `WagTails@123` |
| **Partner (groomer)** | ritika.sharma@wagpartner.in | +919900001111 | `Partner@123` |
| **Partner (walker + groomer)** | aman.verma@wagpartner.in | +919900002222 | `Partner@123` |
| **Partner (groomer, offline)** | neha.pillai@wagpartner.in | +919900003333 | `Partner@123` |
| **Partner (walker)** | karan.joshi@wagpartner.in | +919900004444 | `Partner@123` |
| **Customer (Arjun — Simba)** | arjun.mehta@example.com | +919876543210 | OTP via mock SMS |
| **Customer (Sahana — Mochi)** | sahana.k@example.com | +919876543211 | OTP via mock SMS |
| **Customer (Rohan — Rio)** | rohan.v@example.com | +919876543212 | OTP via mock SMS |

> **OTP login:** In mock mode the OTP is printed in API server logs. Look for `[MOCK OTP]` in the console.

---

## Prerequisites

```bash
# 1. Start Docker services
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 2. Install dependencies
npm install

# 3. Generate Prisma client
cd apps/api && npx prisma generate

# 4. Run migrations
npx prisma migrate dev

# 5. Seed the database
npx prisma db seed

# 6. Start the API
npm run dev:api

# 7. Start web apps (separate terminal)
npm run dev:staff   # http://localhost:3003
npm run dev:admin   # http://localhost:3004
```

---

## 1. API Health Check

1. Open `http://localhost:3001/api/v1/health` — expect `{ "status": "ok" }`.
2. Open `http://localhost:3001/api/docs` — expect Swagger UI to load.

---

## 2. Admin Web — Login & Dashboard

1. Open `http://localhost:3004`.
2. Log in with `admin@wagandtails.in` / `WagTails@123`.
3. **Dashboard** should show real KPI cards (Revenue, Bookings, Store GMV, Cancel Rate).
4. **Channel Split** bar chart should show at least `app` channel with data from seeded bookings.
5. **Top Packages** table should show "Premium" and "Standard" from seeded bookings.
6. **Recent Bookings** table should show Simba and Rio's bookings.

---

## 3. Admin Web — Catalogue Management

### 3a. Coupon CRUD
1. Navigate to **Coupons**.
2. Existing coupons: `WAGWELCOME`, `WALKFIRST`, `WAG10`, `PETSTORE15`.
3. Create a new coupon — click **New Coupon**, fill:
   - Code: `TESTFLAT`
   - Type: Flat
   - Value: ₹100
   - Min order: ₹400
   - Valid from/to: current year
   - Services: grooming
4. Verify the coupon appears in the list.
5. Edit the coupon — toggle `isActive` off.
6. Delete the coupon.

### 3b. Grooming Packages
1. Navigate to **Packages**.
2. Verify 5 packages exist: Basic, Bath + Basic, Standard, Premium, Luxury.
3. Edit "Basic" — change description, save.
4. Verify the updated description shows.

### 3c. Products
1. Navigate to **Products**.
2. Click **New Product**, fill all required fields including trade price.
3. Save and verify it appears in the list.

---

## 4. Admin Web — Partner Management

1. Navigate to **Partners**.
2. All 4 seeded partners should appear.
3. Click on Ritika — verify profile details load.
4. Click **Suspend** — enter a reason — verify status changes to "suspended".
5. Click **Approve** — verify status returns to "approved".
6. Check **Audit Log** — both changes should appear.

---

## 5. Admin Web — Payouts

1. Navigate to **Payouts**.
2. After completing a booking (see step 7), pending payouts should appear.
3. Select payout items → click **Approve Batch**.
4. Navigate to **Payout Batches** → click **Mark Paid**.
5. Verify payout status changes to "paid".

---

## 6. Staff Web — Login & Dashboard

1. Open `http://localhost:3003`.
2. Log in with `staff@wagandtails.in` / `WagTails@123`.
3. Dashboard KPIs should load (Today's Bookings, Unassigned, Needs Partner, etc.).
4. **Attention banner** should show if any bookings need partner assignment.

---

## 7. Staff Web — Booking Flows

### 7a. View and Assign a Booking
1. Navigate to **Bookings**.
2. Filter by status `needs_partner` — Mochi's Standard booking should appear.
3. Click the booking to open detail.
4. Verify pet care notes are visible: *"Mochi has long coat — take breaks during grooming"*.
5. Click **Assign Partner** — select Ritika Sharma.
6. Verify status changes to "assigned".

### 7b. Create an Off-App Booking (Phone Call)
1. Click **New Booking** from the dashboard or bookings page.
2. Search for customer **Arjun Mehta** (+919876543210).
3. Select pet **Simba**.
4. Select service type: **Grooming**, package: **Standard**.
5. Set channel: **Phone Call**.
6. Set date/time and address.
7. Submit — verify booking appears in the list with channel "phone_call".
8. Verify Arjun's care notes for Simba are attached (lavender-free shampoo).

### 7c. Reschedule a Booking
1. Open any confirmed/assigned booking.
2. Click **Reschedule** — pick a new date/time.
3. Verify status history shows the reschedule note.

### 7d. Store Orders
1. Navigate to **Orders**.
2. After placing a store order (step 10), it should appear here.
3. Click an order — click **Mark Packed**.
4. Verify status changes to "packed" and `packedAt` is populated.

---

## 8. Customer App — Registration & Pet Setup

1. Open customer Expo app (`npm run dev:customer`).
2. Enter phone `+919876543210` — tap **Send OTP**.
3. Check API logs for mock OTP code.
4. Enter OTP — verify successful login and home screen.
5. Tap **Your Pets** — verify Simba appears with care notes visible.
6. Tap Simba → **Edit Pet** — change weight from 28.5 to 29 kg → save.
7. Tap **Add Care Note** — add note: *"Simba's ear is healing — be gentle on left ear."*
8. Verify the note appears on the pet profile.

---

## 9. Customer App — Grooming Booking (Full Flow)

1. From home, tap **✂️ Grooming**.
2. **Select Pet**: Select Simba.
3. **Select Package**: Tap **Premium** — expand to see inclusions — tap **Select Package**.
4. **Select Add-ons**: Select **De-matting (₹300)** — verify subtotal updates.
5. **Select Date & Time**: Pick a date 3 days from now, 10:00 AM slot.
6. **Select Address**: Select Arjun's home address (14A Koramangala).
7. **Groomer Note**: Add note — *"Simba had a recent hot spot on left ear. Be gentle."*
8. **Review Booking**:
   - Verify pet name, package, add-on, date, address show correctly.
   - Apply coupon **WAGWELCOME** — verify ₹200 discount applied.
   - Select payment method: **UPI**.
   - Tap **Confirm Booking · ₹1799**.
9. **Booking Confirmed** screen should appear with receipt.
10. Tap **View Booking Details** — verify full receipt, status timeline, care notes visible.

---

## 10. Customer App — Booking Management

From the booking detail screen:
1. Tap **💬 Message Partner** — verify messaging screen opens (no error even if no partner yet).
2. Tap **🗓 Reschedule** — pick a new time — confirm.
3. Verify status history updated.
4. Tap **Cancel Booking** — confirm — verify status changes to "cancelled".

---

## 11. Customer App — Dog Walking (Live Flow)

> Uses a second device/emulator for the partner app.

**Customer side:**
1. From home, tap **🐾 Dog Walking**.
2. **Select Dog**: Select Rio.
3. **Select Duration**: **30 min** — verify pricing shows ₹249.
4. **Schedule**: Tap **⚡ Walk Now** — select address — tap **Find a Walker Now**.
5. **Searching** screen appears with 45s countdown.

**Partner side (Karan — walker):**
1. Open partner app, log in as `karan.joshi@wagpartner.in`.
2. Toggle **Online** — mode should be set to **🐾 Walking**.
3. The walk request notification should appear in Open Jobs.
4. Tap the job to view — verify Rio's care note: *"Tendency to chew leash — use slip-lead."*
5. Tap **Claim Job**.

**Customer side:**
6. Searching screen should update to **"Walker Found! 🎉"** and redirect to Live Walk screen.
7. Verify partner name (Karan Joshi) and status show correctly.

**Partner side:**
8. Status changes to accepted — tap **Navigate to Pickup & Start**.
9. Walk begins — timer starts on customer screen.
10. Tap **+** to add a walk photo.
11. Slide to end walk.

**Customer side:**
12. Walk Summary screen opens — assign 5 stars, write review, no tip.
13. Tap **Submit Review**.

---

## 12. Customer App — Store

1. Navigate to **🛒 Pet Store** tab.
2. Browse **Food & Treats** category.
3. Tap **Farmina N&D Grain-Free** — verify product detail loads.
4. Check for allergy warning if the customer's pet has chicken allergy (Arjun's Simba does).
5. Tap **Add to Cart 🛒** — cart badge updates.
6. Navigate to cart — verify item with quantity.
7. Tap **Proceed to Checkout**.
8. Select delivery address and payment method.
9. Apply coupon **PETSTORE15** — verify discount.
10. Tap **Place Order** — verify order confirmation.
11. Navigate to **My Orders** — verify order with status "placed".
12. Tap order — verify tracking steps show "placed" as active.

---

## 13. Customer App — AI Pet Chat

1. From home, tap **🤖 Pet AI Chat**.
2. Select pet **Simba**.
3. Ask: *"What should the groomer know about Simba?"*
4. Verify response mentions Simba by name and references care notes.
5. Ask: *"What's the weather today?"*
6. Verify off-topic guardrail response: *"Woof! 🐾 I can only answer questions about pets..."*
7. Ask: *"My dog has a rash, what medicine should I give?"*
8. Verify medical guardrail: response should say *"Please consult your vet immediately"*.

---

## 14. Partner App — Grooming Job Flow

1. Log in as **Ritika Sharma** (`ritika.sharma@wagpartner.in`).
2. Toggle **Online** — mode: **✂️ Grooming**.
3. If a grooming booking is in `needs_partner` state and within Ritika's 8km radius, it appears in Open Jobs.
4. Tap the job — verify:
   - Pet name, breed, size, weight visible.
   - Pet care notes shown prominently with orange warning box.
   - Package name and add-ons listed.
   - Payout calculation: booking total × 0.80.
5. Tap **Claim Job** — job moves to **My Jobs** tab.
6. Tap the job → tap **Start Job**.
7. Complete all checklist items (checkmarks).
8. Add at least one "after" photo.
9. Slide to complete — verify success message.
10. Check staff/admin booking list — status should show "completed".

---

## 15. Partner App — Account & Settings

1. Navigate to **Account** tab.
2. Rating and completed jobs should show from seeded data.
3. Tap **Service Radius** — change from 8 km to 10 km — save.
4. Tap **Working Hours** — disable Sunday — save.
5. Tap **Reviews** — Ritika's seeded 5-star review from Arjun should appear.
6. Tap **Documents** — verify upload UI works (mock upload).
7. Tap **Help & Support** — submit a test ticket.

---

## 16. Realtime Updates (Cross-Surface Test)

Run these with the staff web, customer app, and partner app open simultaneously.

1. **Booking created** → Staff web bookings list updates without refresh.
2. **Staff assigns partner** → Partner app My Jobs tab shows the new assignment.
3. **Partner starts job** → Customer booking detail status updates.
4. **Partner completes job** → Admin dashboard completion count increments.
5. **Message sent** → Other participant sees message within 5 seconds (polling fallback if socket not connected).

---

## Known Mock Providers

| Provider | Behaviour |
|----------|-----------|
| SMS (OTP) | OTP printed in API logs as `[MOCK OTP] → +91XXXXXXXXXX: 123456` |
| Payments | Always succeeds, mock order IDs generated |
| Maps/Geocode | Deterministic mock lat/lng near Bengaluru |
| Push notifications | Logged as `[MOCK PUSH]` in API logs — in-app notifications saved to DB |
| LLM (AI chat) | Mock response using pet name from context |
| File storage | Saved to `apps/api/uploads/` directory |
| Email | Logged to console only |

---

## Troubleshooting

### Docker / Database

```bash
# Check containers
docker compose -f infra/docker/docker-compose.dev.yml ps

# View postgres logs
docker compose -f infra/docker/docker-compose.dev.yml logs postgres

# Reset database and re-seed
cd apps/api && npx prisma migrate reset --force
```

### API won't start

- Check `apps/api/.env` has `JWT_SECRET` ≥ 32 characters.
- Ensure `DATABASE_URL` points to running Postgres container.
- Run `npx prisma generate` from `apps/api/`.

### OTP login not working

- Check API logs for `[MOCK OTP]` line — the code is printed there.
- Default mock OTP in development: check API stdout.

### Expo app can't connect to API

- Ensure the device/emulator and dev machine are on the same network.
- Update `extra.apiUrl` in `apps/customer-mobile/app.json` or `apps/partner-mobile/app.json` to use your machine's LAN IP (e.g., `http://192.168.1.x:3001/api/v1`).

### Windows-specific

- If `npm install` fails with EPERM errors, run terminal as Administrator or disable Windows Defender temporarily for the project directory.
- Expo Metro bundler port 8081 may conflict — set `EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0` in env.
