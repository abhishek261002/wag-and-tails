# QA checklist: customer app batch 2

Run on a device/emulator against the VPS API. SMS, payments and KYC are mock.

1. **Add pet, breed**: Pets > Add. Pick Dog, tap Breed: list opens, search "lab" works, scrolls fully, keyboard doesn't hide it, Mixed/Other always reachable.
2. **Login page**: shows "Welcome to Wag & Tails, your pet care service provider." with Sign up / Log in tabs, phone only.
3. **Signup**: new number > OTP > Step 1 Name + City (both required; "Other city" lets you type) > Step 2 pet (name, type, breed, age, gender all required; Add another optional, Remove works) > Create account lands on Home with the pet.
4. **Mismatch**: Log in with an unknown number goes to signup; Sign up with an existing number shows "Welcome back" and logs in.
5. **Active services banner**: book a service; banner appears above the tab bar. With 2+ services it rotates every 4 s in a loop, pauses while dragging, tap opens the booking.
6. **View more**: Grooming > packages: "View more (N services)" under each package name expands/collapses the full list.
7. **Coupons**: Grooming review and Store checkout show "Available coupons"; Apply works; ineligible ones are greyed with the reason.
8. **Medical history**: Pet > Health > Medical history: add/edit/delete a record with a follow-up date. Vaccinations: add; long-press a row to delete.
9. **Reminders**: admin `POST /admin/reminders/run {"job":"daily"}` sends check-up reminders 7 days before, on, and after a follow-up date (once each).
10. **Image compression**: upload a large phone photo as a pet photo; stored file is far smaller (max 1600px, location data removed).
11. **Dr. Woof**: Home card / pet page "Ask Dr. Woof" opens one chat for all pets, no pet selection. Pet/animal questions incl. medication info answered; non-pet questions refused. Needs the Gemini key on the server.
