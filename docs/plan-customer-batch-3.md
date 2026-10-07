# Plan: client batch 3 (home page, insurance, partner types, job ringtone, doctors)

Tracker: tick each box when it is done and verified. Continue from the first unticked item.

## Decisions

- **D1 Home order** (top to bottom): hero (greeting, address, pets; no bell) → "Add your first pet" card (only with no pets) →
  notifications card (3 latest + See all) → Book a service (two compact tiles) → product carousel (+ See all) → coupon
  banner → Ask Dr. Woof → Pet insurance → Book again → trust card (with vets count) → Help & support → "Blood test
  coming soon" strip. The looping active-services banner stays docked at the bottom.
- **D2 Removed from home**: the stacked "Happening now" live cards, the "Coming up" card and the "Nothing booked" card.
  The docked banner already shows every pending and ongoing service and opens the booking page on tap.
- **D3 Service tiles**: about half height (icon + title on one row, price below). Subtitles removed.
- **D4 Notifications card**: shows the 3 most recent notifications (unread dot, time ago). Tap one → opens it (marks read).
  "See all" → notifications page. No notifications → one "You're all caught up" row.
- **D5 Vaccination pop-up**: on opening the app (home first load, once per app launch), if any pet's vaccination state
  is `overdue` or `due_soon`, an animated pop-up lists those pets with "Update records" and "Later". Pets with no
  records or "not vaccinated yet" do not trigger it (would nag every open).
- **D6 Vaccination optional in Add pet**: neither a date nor "Not vaccinated yet" is required. Server accepts neither
  (status `unknown`), still rejects both together.
- **D7 Pet insurance**: home card → form screen. Fields: pet (from their pets), owner name, phone (prefilled), email
  (optional), city, plan interest (Accident only / Comprehensive / Not sure), cover amount (₹25k / ₹50k / ₹1L / Not sure),
  pre-existing conditions (yes/no + details), preferred call time, notes, consent. Saved as `PetInsuranceRequest`
  (status new → contacted → closed). Staff and admin get an "Insurance" page (list, filter by status, change status,
  staff note). Fields can be changed later when the client confirms.
- **D8 Partner type**: `PartnerProfile.employmentType` (`team` | `freelancer`, null = not set). Approving requires
  choosing one. Staff and admin partner lists get a "My team / Freelancers / Not set" filter and a Type column, and the
  type can be changed later for approved partners.
- **D9 Job ringtone**: new Android channel `job-requests` with a bundled `woof.wav`; push for new grooming and walk
  requests (open and direct) uses that channel and sound (iOS: `sound: 'woof.wav'`). Open grooming jobs currently get
  no push at all, only a socket event: add push to eligible partners. Needs a new partner-app native build. The
  bundled bark is synthesised; replace `apps/partner-mobile/assets/sounds/woof.wav` with a real recording any time
  (same file name, then rebuild).
- **D10 Doctors**: not on the home page. Mock list in the app ("Our vets") reachable from Account → Support, and a
  "Vets" count in the home trust card.
- **D12 Wallet**: removed from the customer app only. The API's wallet endpoint and column stay (unused) so nothing else breaks; they can be dropped later.
- **D11 Image compression**: already done server-side for every upload (batch 2). No change.

## Checklist

### Batch A — Customer home
- [x] A1 Remove bell from hero; remove live/coming-up/nothing-booked cards
- [x] A2 Notifications card (3 latest, See all)
- [x] A3 Compact service tiles
- [x] A4 Product carousel (7 products, See all → Store tab)
- [x] A5 Blood test coming soon strip; vets metric in trust card
- [x] A6 Vaccination pop-up on app open

### Batch B — Pets
- [x] B1 Vaccination optional in Add pet (app + API)

### Batch C — Pet insurance
- [x] C1 Prisma model + migration
- [x] C2 API: customer create/list mine; staff/admin list + update status
- [x] C3 Customer home card + form screen
- [x] C4 Staff web + admin web Insurance pages

### Batch D — Partner team / freelancer
- [x] D1 Prisma field + migration
- [x] D2 API: approve requires type; set type; list filter
- [x] D3 Staff web + admin web: approve with type, filter, column, change type

### Batch E — Partner job ringtone
- [x] E1 Sound file + expo-notifications plugin config + `job-requests` channel
- [x] E2 API: push for open grooming jobs; job pushes use channel + sound

### Batch F — Doctors (mock)
- [x] F1 Mock vets list screen, linked from Account → Support

### G — Wallet (added later by the client)
- [x] G1 Remove the wallet completely from the customer app (Account tile, wallet screen, "wallet" payment wording/type, "Refer a friend ₹200" credit row)

### Z — Verify
- [x] Z1 Typecheck API, customer, partner, staff-web, admin-web; API build
- [x] Z2 API tests for new endpoints + regression suites
- [x] Z3 Bundle customer + partner (android, ios, web)
- [x] Z4 QA checklist doc, memory note, final report with commands
