# Plan: customer app batch 2 (client feedback, 2026-10-05)

Rule for every item: build it, verify it (typecheck, bundle the customer app for Android + iOS, API tests for any API
change), then tick it. Screens cannot be run on a device from here, so each UI item gets a line in the phone checklist
`docs/qa-checklist-customer-batch-2.md`.

## Decisions (defaults, change on request)

| # | Question | Default used |
|---|----------|--------------|
| D1 | Pet name at signup | Asked as well (the spec lists type, breed, age, gender; a pet needs a name and the home screen shows it). |
| D2 | Vaccination at signup | Not asked at signup (the spec keeps signup short). Recorded later from the pet's Health records; the pet shows "No vaccine records yet" until then. Add-pet from the app still asks. |
| D3 | City | Picked from the service cities (Kanpur, Lucknow, Delhi) or typed ("Other city"). Stored on the customer profile. |
| D4 | Login with a number that has no account / Sign up with a number that has one | After the code is verified: login continues to account creation; sign up logs the existing customer in. No account existence is revealed before the code is verified. |
| D5 | Active services banner position | Docked on Home just above the bottom tab bar (Zomato style), auto-rotating every 4 s when more than one service is active; tap opens the booking. Shows pending (confirmed, finding partner) and ongoing services. |
| D6 | Dr. Woof and medicines | Answers general questions about medicines (what they are for, common side effects, interactions with a pet's listed allergies), never doses or prescriptions, always says to confirm with a vet. |
| D7 | Image compression | On the server, for every image any app uploads: resized to at most 1600 px, re-encoded (JPEG/WebP, quality 80), EXIF (incl. GPS) removed, orientation fixed. HEIC is stored as is (the phone apps already send JPEG). |
| D8 | Medical history | New records: type (check-up, illness, surgery, medication, allergy, other), title, date, notes, vet, optional follow-up date. A follow-up date creates check-up reminders (7 days before, on the day, then overdue). |

## Checklist

- [x] **A1 Breed dropdown**: the picker list cannot scroll fully and is covered by the keyboard. Rebuild as a proper searchable sheet (scrolls, keyboard-safe, empty state, selected tick). Fix BottomSheet's swipe-to-close using a stale callback.
- [x] **A2 Login page**: Sign up / Log in choice, "Welcome to Wag & Tails, your pet care service provider.", phone number only.
- [x] **A3 Account creation**: after the OTP, mandatory Name + City, then pets (at least one; more optional): name, type, breed, age, gender. API: new atomic registration (user + profile + city + pets in one transaction), email/date of birth no longer required. Migration: customer city.
- [x] **B1 Active services banner** (D5).
- [x] **B2 Packages**: "View more" under each package name expands the full list of services.
- [x] **B3 Checkout coupons**: an "Available coupons" list on grooming and walking checkout; each shows what it saves or why it can't be used; tap to apply. API: per-customer eligibility endpoint.
- [x] **C1 Medical history + vaccinations** on add-pet and on the pet page (D8). API + migration.
- [x] **C2 Reminders** from follow-up dates (D8); vaccination reminders already exist.
- [x] **D1 Image compression** (D7), all upload paths.
- [x] **E1 Dr. Woof**: one chatbot with context of all the customer's pets, general pet/animal questions, refuses non-animal topics; home link "Ask Dr. Woof"; old per-pet chat replaced.
- [x] **Z** Regression of earlier API suites, typecheck all apps, bundle both mobile apps, phone checklist, commit.
