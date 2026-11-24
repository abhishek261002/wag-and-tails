# QA checklist: website + apps integration

What still needs a person with real phones. Everything below the line "Already checked automatically" was tested on the local staging copy by `infra/wp-staging/tests/apps-integration-test.js` (80 checks) and `connector-test.js` (49 checks).

Setup for phone testing: staging WordPress running (`infra/wp-staging`), the API on your PC with `WP_CONNECTOR_URL=http://<PC LAN IP>:8090/wp-json` reachable from the phones, a dev build of both apps pointing at the PC.

## Customer app
- [ ] With the website connected, the grooming flow asks for the **address before the package**.
- [ ] An address in Lucknow goes straight on; an address whose city is "Mumbai" asks **which area** (North / South / Navi Mumbai); a city the website does not serve shows "not in your area yet" with the list of cities.
- [ ] An address without a 6-digit pincode asks for the pincode.
- [ ] Package prices match the website for that city (Mumbai prices are higher).
- [ ] Date and time shows only the website's free times; a fully booked day shows **Full**; the list refreshes while the screen is open.
- [ ] Review screen: price from the website; coupon PAMPER applies; an invalid coupon shows the website's message; **Use my points** appears when the customer has points and changes the total.
- [ ] Pay after service → booking confirmed; the desk shows it with source **App**.
- [ ] Pay online (Razorpay test key) → the desk shows **Paid · Online**.
- [ ] Two phones book the same last slot at the same time → the second gets "That time was just booked" and goes back to the times.
- [ ] Reschedule shows the website's free times; moving or cancelling inside 4 hours shows "please call or WhatsApp us".
- [ ] Account → **Reward points** shows the balance, rules and history.
- [ ] Account → **Website & phone bookings** lists bookings made on the website with the same number.
- [ ] Account → **Complaints**: raise one about a completed booking (within 24 h) with a photo; it appears in the website's Complaints list; status shows in the app.
- [ ] Completed website-linked booking shows **Report a problem** for 24 hours.
- [ ] Offers shows website coupons as "No expiry".
- [ ] Walk booking works in a city with walking on, and is refused with a clear message where it is off.

## Partner app
- [ ] A website booking rings online partners in that city (bark ringtone), including with the app in the background.
- [ ] Job cards show the date for future days, the source (Website / Phone call), and the aggression level when it is not "Calm".
- [ ] Team (salaried) partner: cards say **Team job**; the job screen says "Salaried, no per-job split".
- [ ] Job screen shows the website reference and a red **Temperament** box for nervous / aggressive pets.
- [ ] Desk assigns the job → "Job assigned to you" push; the job appears in My jobs without refreshing.
- [ ] Desk moves the booking → push "Job rescheduled"; the job screen shows **This booking was moved** with **I can do it / I can't**.
- [ ] Desk changes the price → the job screen shows the new total within 20 seconds.
- [ ] **I can't do this job** (before arriving) with a reason → job leaves My jobs; desk card shows "Released by groomer".
- [ ] **Customer not available** before 15 minutes at the door → "Please wait N more minutes"; after → camera, photo, desk alerted, customer push.
- [ ] **Stop the job (unsafe)** with a reason → desk card shows it in red.
- [ ] Desk cancels → the job disappears and the partner gets a push.

## Website (desk and admin panel)
- [ ] Desk card shows the groomer chip; **Assign groomer** lists groomers best first; Assign, Change and Remove all work for a desk user limited to one city.
- [ ] Filters **No groomer yet**, **Running late**, **In progress now**, **Needs attention**.
- [ ] Apps & partners: live map shows today's jobs and moving groomers; the settings save and reach the apps within 5 minutes.
- [ ] "Groomer on the way" WhatsApp link opens the tracking page on a phone without logging in; it shows the groomer moving and the ETA.
- [ ] After Meta approves the templates: website customers get "groomer assigned", "on the way" (with start code) and the end code; app customers do not get these WhatsApps (they see them in the app).

## Already checked automatically (staging)
Website booking → job; customer, pet, address matched by phone; desk card searching / assigned / on the way / in progress / completed; WhatsApp attempts with codes and tracking link; tracking page and data; cash completion with points and commission; echo messages ignored; desk reschedule (with reconfirm), price change (with commission repricing), cancel, complete (team partner without commission); partner release; desk partner list and assign (signed, through the plugin too); escalation timer and desk alert; app booking reserves the slot first; pay after service; full slot refused; app cancel; online payment hold and confirm; 4-hour rule; same account for website and app; points; website history; complaints; booking config; walking switch; "customer not available" wait rule and flag; stop job; desk filters; settings sync; catch-up poll; no failed writes.
