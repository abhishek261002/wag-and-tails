# Plan: client app review fixes (customer app)

Source: "APP REVIEW" PDF from the client. Tracker: tick a box only when the item is done AND verified. Continue from the first unticked box.

## Review item → decision

| # | Review item | Decision |
|---|---|---|
| 1 | Signup/login: "Email option" | The earlier brief says login is phone only, so login stays phone-only. An **optional email** field is added to account creation (the API already accepts one) and shown on the profile. Flag to the client: email *login* is not built. |
| 2 | Add pet: missing breeds (Doodles and sub-breeds; cats Calico, Tuxedo) | Extend the shared breed lists (also validated by the API): all common Doodles, many more dog breeds incl. Indian breeds, more cat breeds/coats incl. Calico, Tuxedo, Tabby. Old values stay valid. |
| 3 | Home: differentiate "Pet care" in the 2nd section. Dr. Woof, Pet insurance, Blood test in one **light-blue card**; blood-test callout moved up, **under Pet insurance** | New "Pet care" section: one light-blue card with three rows in this order: Ask Dr. Woof, Pet insurance, Blood tests (coming soon). The old blood-test strip at the bottom is removed. |
| 4 | Pet insurance icon must differ from the social-proof banner | New dedicated icon (umbrella/cover) for insurance; the trust banner keeps the shield. |
| 5 | "Every partner is verified" banner blends in; padding off | Restyle: dark brand card, white text, marigold accent, balanced padding, metrics in a translucent row. |
| 6 | Pet Store: category pills cropped | Root cause: horizontal list inside a flex column grows/shrinks with its siblings. Fix: fixed-height, non-shrinking, non-growing list. |
| 7 | Store search: pills enlarge; blank gap above the tab bar after leaving search | Same list fix; debounce search and ignore stale responses; hide the tab bar while the keyboard is open (the usual cause of the leftover gap on Android). |
| 8 | Dr. Woof: no chat history screen | New History screen (list of past chats: title, preview, date, count), open a chat, delete a chat, start a new one. API: richer sessions list + delete. |
| 9 | Dr. Woof: optional photos in chat | Built, but **off by default** (cost decision): server flag `DR_WOOF_IMAGES=true` turns it on; the app shows the photo button only when enabled. Photos are compressed like every other upload. |
| 10 | Pet insurance disclaimer / "not finalized" | Nothing to do (already shown). |
| 11 | Packages: no price laddering; tags "Best value", "Best selling", "Previously booked"; short description visible without "View more" | Server computes tags per package (per customer/pet for "Previously booked"). Cards show up to two tags, the description (2 lines), and a ladder line ("Everything in Basic, plus 3 more" or "N services included"). |
| 12 | Booking confirmation: support button | "Need help? Contact support" on both the waiting and confirmed states; opens Support with a new-ticket form prefilled with the booking id. The screen becomes scrollable so nothing is cut off. |
| 13 | Navigation bar overlaps Android system navigation | Tab bar height/padding now include the bottom safe-area inset (customer and partner apps). |

## Checklist

### A — Home (items 3, 4, 5)
- [x] A1 New insurance icon in ui-mobile
- [x] A2 "Pet care" light-blue card: Dr. Woof, Pet insurance, Blood tests (coming soon); old strip removed
- [x] A3 Trust banner restyled (colour, padding)

### B — Pet store (items 6, 7)
- [x] B1 Category pills no longer cropped/enlarged
- [x] B2 Search: debounce, stale-response guard, empty/loading states
- [x] B3 Tab bar hides on keyboard (no gap after leaving search)

### C — Navigation bar (item 13)
- [x] C1 Tab bar respects the Android system navigation inset (both apps)

### D — Breeds (item 2)
- [x] D1 Extended dog and cat lists; API accepts them; picker finds "doodle", "calico", "tuxedo"

### E — Packages (item 11)
- [x] E1 API: `tags` on packages (best value, best selling, previously booked) + per-pet scope
- [x] E2 App: tag chips, visible description, ladder line

### F — Support from booking confirmation (item 12)
- [x] F1 Support button on confirmation screen (waiting and confirmed), screen scrolls
- [x] F2 Support screen opens the new-ticket form prefilled when given a booking id

### G — Dr. Woof (items 8, 9)
- [x] G1 API: sessions with title/preview/count; delete a session
- [x] G2 History screen + open a chosen chat + delete + new chat
- [x] G3 Photo support behind `DR_WOOF_IMAGES` (API + app)

### H — Signup email (item 1)
- [x] H1 Optional email on account creation; validated; saved

### Z — Verify end to end
- [x] Z1 Typecheck API, customer, partner, admin, staff; API build
- [x] Z2 API tests (new + all earlier suites)
- [x] Z3 Browser tests of the changed screens (headless Chrome against the web build)
- [x] Z4 Android/iOS/web bundles; Android bundle still contains the native Modal host
- [x] Z5 QA checklist doc for the phone, memory note, final report
