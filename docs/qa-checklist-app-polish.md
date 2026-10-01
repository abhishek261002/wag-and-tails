# Phone checklist: app polish batch

Everything here was checked with automated tests, type checks and bundle builds, but the screens have not been run on a
device. Go through this list on your phone and tell me anything that looks or behaves wrong. Each line says what you
should see.

Before you start, the customer and partner apps need the rebuilt development build (the map library is native code):
`npx eas-cli build --profile development --platform android` in each app folder, then install the APK. Metro and the
API must be running (`npx expo start --dev-client -c` in each app, `npm run dev` in `apps/api`).

## Bugs fixed

- [ ] **Stays signed in**: use the customer app for more than 15 minutes. You are not logged out and no red error appears.
- [ ] **Directions open** (partner): accept a job, tap "On my way". The navigation screen opens with a map and no red
      "Invalid prop source" error.
- [ ] **Booking details open** (partner and customer): no red errors.
- [ ] **Chat order**: send three messages back and forth. Oldest at the top, newest at the bottom, and the view stays at the bottom.
- [ ] **Payment method** (grooming review): two full-width cards, "Pay after service" and "Pay online", each with an icon, a
      title and a hint, and a radio dot. Tapping one selects it (brown border).
- [ ] **Typing works** in login, sign-up and every form (the earlier focus bug).

## Booking flow

- [ ] **Date picker includes today**. At 11:21 the first slot today is 12:00 PM. Slots that are too soon are not shown.
- [ ] Late in the evening, "Today" is greyed out ("Full") and the first day with slots is selected.
- [ ] Leave the screen open across a slot's start time: the slot disappears and you are told to pick another.
- [ ] Same behaviour on the walking scheduler and on Reschedule.
- [ ] **Who should groom?** Two full-width brown buttons: "Find Instantly" and "Choose Partner".
- [ ] "Find Instantly" shows no partner list. Under it: "Your request goes to every available partner nearby...".
- [ ] "Choose Partner" slides a drawer up from the bottom with All partners and Past partners tabs. Picking a partner closes
      the drawer and shows that partner under the buttons with a Change link.
- [ ] Confirm a "Find Instantly" booking: a brief "Finding a partner for you..." loader, then you are on Home.
- [ ] Home shows a "Finding a partner" card with View request and Cancel.

## Live tracking

- [ ] Partner accepts and taps "On my way": Home card becomes "On the way" with "Arriving h:mm am", Track, a phone button and Details.
- [ ] Booking details (customer) shows a live map tile **above "Pet & Service"** with the partner moving, "arrives in N min",
      Open full map, Call and Chat. It is not shown in any other status.
- [ ] Call opens the dialer with the partner's number. Chat opens the conversation.
- [ ] After the partner has arrived the tile is gone and Track still works.
- [ ] Two active bookings show two cards on Home (up to 3).

## Home, Pets, Bookings, Account

- [ ] Bottom bar: Home, Store, Bookings, **Pets**, Account.
- [ ] Home "Book again" is for the selected pet (tap another pet in the row: the list changes). "See all" opens Bookings.
      Rebook starts a new booking for the same pet and package.
- [ ] **Pets tab**: "N in your family", a + button, a card per pet with breed, age, weight, a vaccination chip
      (Vaccinated / Booster due / ...) and "N visits", and a dashed "Add a pet" row.
- [ ] **Bookings tab**: big Upcoming and Past tabs. A small All / Grooming / Walking filter below. Cards show the service, pet,
      time, partner and code, price and the right buttons (Track / Reschedule / Details). Pull to refresh; scroll loads more.
- [ ] **Account**: the first tile shows your photo (or initial), name and phone; tapping it opens Personal information.
- [ ] Personal information: change photo, name, email, date of birth; phone is read-only with "Verified". Save changes works;
      a bad email or a used email shows an error under the field.

## Pet page

- [ ] Tap a pet: centred photo, name, "Breed · age · sex · weight". Buttons Groom, Walk (dogs only), Ask.
- [ ] Care notes: your notes have a pencil; tapping it edits (with Delete note). "Add" adds a note. Groomers' notes cannot be edited by you.
- [ ] Health card: "Vaccinations up to date" or "Booster due"; tapping opens Vaccinations. Add a record there; it appears with Valid or Expired.
- [ ] About table, Temperament card and the vet row (call button opens the dialer).
- [ ] **Grooming history**: each finished visit shows package, date, groomer, stars, and a **BEFORE** and an **AFTER** photo.
      Tapping a photo opens it full size.
- [ ] Remove pet asks first; a pet with an upcoming booking cannot be removed and tells you why.

## Partner onboarding

- [ ] Sign up as a **groomer**: after verification you land on "Show us your tools" (not straight on Pending).
- [ ] Add photos from the camera and from the gallery, plus a video. Each shows a spinner, then the picture. Remove works.
- [ ] Continue stays disabled until 3 photos are added. The 11th photo and the 4th video are refused with a clear message.
- [ ] A file that is too large (photo over 10 MB, video over 50 MB) is skipped with a message.
- [ ] Sign up as a **walker**: no tools step.
- [ ] Close the app on the Pending screen and reopen: a groomer without enough photos sees "One more step: show us your tools".
- [ ] Account has a "Your tools" row for adding more later.
- [ ] **Staff portal**: open the partner: a Tools card shows photos (click to enlarge) and videos (play in place). Approve is
      disabled until a groomer has 3 photos.
- [ ] **Admin portal**: the partner page shows the same Tools card. Approving a groomer with too few photos shows the error.

## Addresses and maps (earlier batch)

- [ ] Add address: search, use current location, drag the map, confirm, fill in flat and pincode, save.
- [ ] The map draws with Ola tiles (after you set `EXPO_PUBLIC_OLA_MAPS_API_KEY`), otherwise OpenStreetMap tiles.
