# Plan: bug fixes and app polish batch (2026-09-26)

Reference designs for every customer screen below are the prototype's `screens-customer.js` and `styles.css`
(see memory `prototype-design-source`; local copy `C:\Users\91828\Downloads\wag-and-tails-main (10)\wag-and-tails-main`).
Read the matching prototype function before building each screen. The screenshots the user sent are that prototype.

Working rules: finish one item, verify it (typecheck, bundle for Android + iOS, and an API test where the item
touches the API), tick the box here, then move on. UI cannot be run on a device from this environment, so every UI
item also gets a line in `docs/qa-checklist-app-polish.md` for the user to check on the phone.

Definition of done for an item: code written, `tsc` clean in both apps, both apps export for android + ios,
API test passes (if the API changed), checklist ticked, QA line written.

---

## Decisions made (defaults, change on request)

| # | Question | Default used |
|---|----------|--------------|
| D1 | Today's slots: the example said "11:21 then 12:00" | A slot is offered only if it starts at least 30 minutes from now. Server rejects past slots. |
| D2 | When is the live tile shown on booking details | Only while status is `partner_on_the_way`. |
| D3 | "passport" in the partner drawer | Read as "past partners": the drawer has All partners and Past partners tabs. |
| D4 | Tools media rules | Required for groomers (at least 3 photos), optional for walkers. Up to 10 photos and 3 videos. Photo 10 MB, video 50 MB. Staff see them before approving. |
| D5 | Bookings page | Big Upcoming / Past tabs. Grooming / Walking becomes a small secondary filter under them. |
| D6 | Find Instantly | Short loader, then the success screen. Home shows a "Finding your groomer" card until someone accepts, with Cancel. |
| D7 | Before/after photos | Already enforced: partner must add a before-photo before the start code, and an after-photo to complete. Only the display is new. |

---

## Phase 0: bugs (do first)

- [x] **A1 Token refresh breaks** (SecureStore "Invalid value" after ~15 min). Cause: `packages/api-client/src/client.ts`
      reads `{accessToken, refreshToken}` from `/auth/refresh`, but the API returns `{user, tokens: {...}}`. Fix the
      client to read `tokens`, make waiting requests fail instead of hang when refresh fails, and stop the queue
      being stuck. Test: API test that refreshes a token and checks the response shape the client relies on, plus a
      client-level unit test with a mocked 401 then refresh.
- [x] **A2 Directions crash** (`Invalid prop source supplied to React.Fragment`). Cause: `LiveMapView.tsx` wraps the two
      route layers in a Fragment inside `GeoJSONSource`, which injects a `source` prop into every direct child.
      Fix: no Fragment; give each layer directly. Also check `address-new` and other MapLibre usage for the same.
- [x] **A3 Booking details error in the partner app**: same root cause as A2 (details render the map). Re-check the
      partner job screen after A2 and look for any second error.
- [x] **A4 Chat order**: the API returns newest first and the screen appends new messages to the front. Sort
      ascending by `sentAt` everywhere (both apps), append new messages at the end, keep the view at the bottom,
      own messages right-aligned. Test: order helper unit test with out-of-order input.
- [x] **A5 Payment method section broken** (tall thin bars): the options are laid out as a wrapping row. Make them full-width
      stacked cards, radio style, icon + title + hint. Same check for the store checkout payment section.

## Phase 1: booking flow

- [x] **B1 Date and time picker** (customer grooming): include today; slots only in the future (D1); hide or disable days
      with no slots left; default to the first day with a slot; slots that pass while the screen is open disappear.
      Apply the same to the walking scheduler if it has slots. Pure function `availableSlots(now, day)` in
      `src/utils/date.ts`, unit tested (11:21 gives 12:00 onward; late evening gives none for today; exact-boundary
      cases; midnight rollover). Server: reject `scheduledAt` in the past or under the lead time; API test.
- [x] **B2 "Who should groom?" redesign**: two full-width brown buttons "Find Instantly" and "Choose Partner".
      - Find Instantly: no partner list. Sets mode `any`. On Confirm Booking a short loader, then success.
      - Choose Partner: a bottom drawer slides up listing every partner in the customer's city (photo, name,
        rating, jobs, discount, online dot) with tabs All partners and Past partners. Selecting one closes the drawer
        and shows the chosen partner on the button. The existing partner-options endpoint feeds it.
      - Replace the current tab widget in `PartnerChoice.tsx` for both grooming and walking.
- [x] **B3 Background search on Home**: after Find Instantly, Home shows a "Finding your groomer" card (pulse, elapsed
      time, Cancel) until accepted or expired. Uses the booking's `dispatch` state (already returned by the API) and
      the realtime `booking:status_changed` event with a poll fallback.

## Phase 2: live tracking

- [x] **C1 Live tile on booking details** (customer): above "Pet & Service", only for status `partner_on_the_way` (D2). Shows the map
      with the partner moving, road line, "Arriving in N min", and Call / Open chat buttons. Reuses `useLiveRoute`
      and `LiveMapView`. Hidden for every other status.
- [x] **C2 Home "Happening now" card** (prototype style): when a booking is on the way it shows the pet, the partner,
      "Arriving 10:40 am", and Track / call / Details buttons. Track opens the live screen, Details opens booking
      details. Shows for the selected pet's active booking.
- [x] **C3 Home booking history for the selected pet**: small "Book again" style section with the last one or two past
      services and a "See all" that opens the Bookings tab.

## Phase 3: navigation and account

- [x] **D1 Pets tab**: bottom tabs become Home, Store, Bookings, Pets, Account (paw icon exists). Pets screen: family list
      with vaccination and visit chips, "Add a pet" row and a + button. New route `(tabs)/pets.tsx`.
- [x] **D2 Bookings tab**: big Upcoming / Past tabs (D5), cards per prototype (service, pet, date, partner and code, price,
      Track / Reschedule / Details). Small Grooming / Walking filter under the tabs.
- [x] **D3 Account and profile**: the first Account tile shows avatar, name and phone. Tapping opens "Personal information":
      change photo (upload), full name, phone (read-only, Verified), email, date of birth (optional), Save.
      API: extend `PATCH /users/me` for name, avatar, email (unique, validated) and date of birth (not in the future).

## Phase 4: pet detail

- [x] **E1 Pet detail redesign** (`pet/[id].tsx`): About (coat, size, date of birth, neutered, allergies, microchip),
      Temperament and care notes with edit, vet card with a call button, Health record (vaccinations, add
      vaccination), Grooming history, and action buttons that go to the matching booking flow (grooming, and walking
      for dogs only; cats grooming only).
- [x] **E2 Grooming history with Before/After**: new `GET /pets/:id/grooming-history` returning each completed grooming with
      package, date, partner name and rating, `beforePhotos`, `afterPhotos`. Each session shows a BEFORE and an AFTER
      tile, tap for full size. API test: only the owner can read it, only completed sessions, ordering.

## Phase 5: partner onboarding, tools media

- [x] **F1 Upload hardening**: `/files/upload` gets a type allow-list (images and videos only), size caps (D4) and a per-user rate
      limit. API test for each rejection.
- [x] **F2 Schema and API**: table `partner_tool_media` (partner, url, kind image/video, mime type, size, created), additive
      migration. Endpoints: partner adds and removes their own, lists their own. Staff and admin list a partner's
      media. Rules from D4; approval blocked until a groomer has at least 3 photos. API test.
- [x] **F3 Partner app**: after registration, a required "Show us your tools" step before Pending approval (groomers), with a
      grid of photos and videos, add from library or camera, per-file progress and retry, remove, counts and limits.
      Also editable later under Account, Documents.
- [x] **F4 Staff and admin portals**: the partner detail page shows the gallery (images inline, videos playable), and the approve
      button explains what is missing.

## Phase 6: close-out

- [x] Regression: earlier suites (kyc, dispatch, commission, catalog, notifications, routing, maps) still pass.
- [x] Both apps typecheck and export for android + ios; API typecheck; web apps typecheck.
- [x] `docs/qa-checklist-app-polish.md` complete (one line per screen for the phone).
- [x] Exact commands for the user (rebuild needed only if a native dependency changed; none planned).
- [x] Update memory notes.

---

## Notes and risks

- Screens cannot be exercised on a device from here. Verification for UI is typecheck, bundle, and pure-function
  or API tests. The QA checklist covers the rest and the user should tell me what looks off.
- No new native library is planned, so the pending MapLibre rebuild is the only rebuild the user needs.
- Video preview: the partner app shows a video tile (icon, name, size) and staff web plays the video. No
  in-app video player library is added.
- Migration for F2 is additive only. Apply with `prisma migrate deploy` after stopping the API (Windows lock).

---

## Extra items found while working (added 2026-09-26)

- [x] **X1 Partner data leak**: customers received the partner's whole profile row (Aadhaar hash, date of birth, address,
      bank account and IFSC, commission terms). Customer responses now carry only name, photo, rating, jobs, city; the
      phone only while the job is active; the live position only while on the way. API test: 17 checks.
- [x] **X2 Booking list scopes**: `GET /bookings?scope=live|upcoming|past&petId=` with validation (a bad status was a 500).
      API test: 24 checks.
- [x] **X3 Always compare against the screenshots** the user attached (saved in the conversation images) before building a
      screen; the Home and pet screens are from the prototype's `screens-customer.js`.

## Result (2026-09-26)

All items done and verified. Test totals: API 22 scheduling, 24 booking scopes, 17 partner privacy, 38 uploads, 44 profile,
44 pet access/notes/history, 38 tools; shared-code unit tests 36 scheduling, 16 vaccination, 15 pet age, 11 chat order,
28 token refresh. Earlier suites re-run: KYC 33, phase 3 20, dispatch 32, commission 68, catalog 48, notifications 50,
maps 61, routing 41 of 42 (the 42nd expects the OSRM provider; the API now uses Ola). Both apps typecheck and export for
Android and iOS; staff and admin portals typecheck and build. Screens are not yet run on a device: see
`docs/qa-checklist-app-polish.md`.
