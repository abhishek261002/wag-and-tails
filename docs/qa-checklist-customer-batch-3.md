# QA checklist: client batch 3

SMS, payments and push are mock unless `PUSH_PROVIDER=expo` on the server.

## Customer app: home
1. No bell icon at the top. Under the pets, a **Notifications** card shows the 3 latest (unread ones bold with a dot). Tapping one opens it; **See all** opens the notifications page.
2. No stacked "Happening now" / "Coming up" cards. With bookings pending or ongoing, only the looping banner above the tab bar shows them; tapping opens the booking.
3. Grooming and Dog walking tiles are about half their old height, with no subtitles.
4. Below them, **Shop for your pet** shows up to 7 products and a See all card. Both See all links open the Store tab, and tapping a product opens it.
5. Below Ask Dr. Woof there's a **Pet insurance** card. The trust card shows a 4th "Vets" count that opens **Our vets**. A small "Blood tests at home · coming soon" strip is at the very bottom.
6. **Vaccination pop-up**: give a pet a vaccine dated over a year ago. Close and reopen the app: an animated pop-up lists the pet; "Update records" opens its vaccinations and "Remind me later" closes it. It shows once per app launch only.

## Customer app: other
7. Add pet: the vaccination step can be skipped (Next works with nothing filled). Edit pet: the same field is optional.
8. Pet insurance: pick a pet, check the prefilled details, answer the existing-illness question, tick consent and send. You see "Request received". Opening it again shows that pet as "Requested".
9. Account: no Wallet tile (now "Pets"), no "Refer a friend". Account → Support → **Our vets** lists 6 sample doctors.

## Staff and admin panels
10. **Pet insurance** in the sidebar: filter by New/Contacted/Closed, search by phone. Open a request, set Contacted, add a note, Save.
11. **Partners**: approving a partner asks **My team** or **Freelancer** and can't be approved without one. The list has a Type column and filters My team / Freelancers / Type not set. Approved partners can be switched (staff: in the partner dialog; admin: on the partner page).

## Partner app (needs a new native build)
12. Go online. A customer books grooming (pay after service) in the partner's city, and the phone rings with the bark sound, also when the app is in the background. Walk requests and direct requests ring the same way.
13. Android: Settings → Apps → partner app → Notifications shows a "New job requests" channel.
