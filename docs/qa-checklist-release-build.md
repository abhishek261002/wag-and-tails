# Release-build test checklist (Android phone)

Why this exists: the web version and the real phone build behave differently. Web uses react-native-web (its own
Modal, Switch, spinner...), the phone uses the native ones. Always run this on a **built APK**, not only on web.

Build (PC terminal, in `apps/customer-mobile`): `eas build --platform android --profile preview`
Partner app (PC terminal, in `apps/partner-mobile`): `eas build --platform android --profile preview`
Install the APK on your phone. An old install may stay on the old code, so uninstall it first.

## A. The three reported bugs
1. **Grooming → pick a pet → packages**: the list shows within a second or two (spinner first), no crash.
   Every package has "View more (N services)"; tap it, the full list opens; tap again, it closes.
   Turn on airplane mode, reopen the screen: "Couldn't load packages. Tap to try again", then tap it after reconnecting.
2. **Add pet → Dog → Breed**: a sheet slides up with a search box and a list. Type "lab" and the list narrows; tap a breed
   and the sheet closes with the breed filled in. Check with the keyboard open: the list is still visible. Repeat for Cat.
   Mixed and Other are at the bottom of the list.
3. **Grooming review and Dog walk schedule → "Choose Partner"**: tapping it slides up the partner list (All / Past tabs);
   pick one and the sheet closes, showing the partner with "Change". "Find Instantly" switches back. Do this for both
   grooming and walking.

## B. Everything else that used the broken native pieces (check each once)
- Date picker (Add pet date of birth, vaccination date, medical record dates): the sheet opens, a date can be picked.
- Pet insurance form, Medical history form, Vaccinations form: the add/edit sheets open and scroll with the keyboard up.
- City picker on sign-up (Step 1) and breed picker on sign-up (Step 2).
- Pull down to refresh on Home, Bookings, Pets.
- Loading spinners show on the packages, add-ons, partner list and checkout.
- Notification toggles (Account → Notifications) can be switched.
- Horizontal lists scroll sideways: pets row on Home, product carousel, Book again.
- Vaccination pop-up on app open (see batch 3 checklist).

## C. Partner app (it had the same problem)
- Online/offline switch on the Jobs/Home screen flips and stays.
- Any sheet or modal (job details, tools upload, KYC steps) opens.
- Pull to refresh works.

## D. Errors should not close the app
- A screen that fails to load now shows "Something went wrong · Try again" instead of closing the app. If you ever see it,
  note which screen and what you tapped.

## E. Admin panel
- Packages: the "Services" column shows the real count (not 0). Edit a package: services show one per line, change one,
  Save: the customer app shows the new list. Saving with the services box empty is refused.
