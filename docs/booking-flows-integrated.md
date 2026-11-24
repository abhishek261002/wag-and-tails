# Integrated booking flows: website + customer app + partner app + panel

Status: **proposal for approval**. Nothing is built yet. Section 9 lists every decision with my recommended default; reply with the numbers you agree with or want changed.
Written for: you (and the client). Builds on `docs/wordpress-admin-integration.md` (the Connector design).

## 1. The ground rules (apply to every flow)

1. **One booking, one record.** Every booking, whether it came from the website, the customer app or a phone call, exists once in the WordPress plugin (the business record staff see) and once as a linked **job** in our backend (what partners work on). They share the plugin reference `WT-XXXXXXX`.
2. **One slot calendar.** Free time slots always come from the plugin (city capacity, buffer, holidays). The customer app asks the plugin through our backend, so the website and the app can never double-book the same slot.
3. **One price list.** Cities, package prices per city, coupons and reward points are set in the plugin's admin panel and used by both the website and the app.
4. **One identity.** A customer is their 10-digit mobile number, on the website and in the app. Same number = same customer, same history, same points.
5. **Partners only work in the partner app.** Assignment, travel, start, payment collection and completion happen there, and every step shows up live on the staff desk.
6. **Staff and admin work in one panel** (the existing WordPress panel), with a new "Apps and partners" section.
7. **If one side is down, the other keeps working.** Changes queue and retry; nobody is blocked.

## 2. One lifecycle, two views

The plugin keeps its simple statuses for the business; the job carries the detailed partner progress, shown on the desk card as a chip.

| What is happening | Plugin status (desk, reports) | Job status (apps) | Desk card shows |
|---|---|---|---|
| Online payment started, not finished | Pending payment | (no job yet) | Pending payment |
| Booked, looking for a partner | Confirmed | Looking for partner | "Finding groomer" (amber) |
| Offered to one chosen partner | Confirmed | Waiting for partner X | "Asked: Ritika" |
| Partner accepted | Confirmed | Assigned | "Ritika · assigned" |
| Partner travelling | Confirmed | On the way | "Ritika · on the way · ETA 12 min" |
| Partner at the door | Confirmed | Arrived | "Arrived" |
| Groom started (start code entered) | Confirmed | In progress | "In progress" |
| Groom done, payment recorded | **Completed** (payment mode Cash or Online) | Completed | "Completed · Cash ₹1,299" |
| Date or time moved | **Rescheduled** | Back to Assigned (partner re-confirms) or Looking for partner | "Rescheduled · needs reconfirm" |
| Cancelled by anyone | **Cancelled** (with reason) | Cancelled | "Cancelled" |
| Nobody accepted in time | Confirmed + red flag | Needs staff | "No groomer yet" (red) |

## 3. Customer flows

### 3.1 Book grooming on the website (as today, plus groomer details)
1. The customer picks city, package, pet details, address with a map pin, date and slot, and pays online or chooses pay after service. **No change** to the website screens.
2. The booking is saved in the plugin; the customer gets the usual WhatsApp and email confirmation.
3. The Connector tells our backend → a job is created and **offered to partners** (section 4.2).
4. When a partner accepts, the customer gets a WhatsApp: "Your groomer Ritika is confirmed for 28 Oct, 11:30am" (new template).
5. On the day: WhatsApp when the groomer is on the way, with a **live-tracking link** (a web page from our backend, no app needed).
6. The groomer arrives. The customer gives the **start code** (sent in the "on the way" message), the groom happens, and the customer gives the **end code**. Payment is either already paid online, or paid to the groomer in cash or UPI.
7. Completed: the plugin sends its usual "Grooming complete" WhatsApp and adds reward points. A review request follows as today.
8. A complaint is possible within 24 hours (as today), and the desk can book a free redo.

### 3.2 Book grooming in the customer app
1. The customer logs in with their mobile number. If they have booked on the website before, their **history and points are already there**.
2. Pick a pet, a package (prices for the customer's city), add-ons, date and slot (**slots come from the plugin**), address, coupon or **reward points**, and a partner choice: "Find instantly" (any partner) or "Choose partner" (one they liked before).
3. Pay online (Razorpay) or pay after service.
4. Our backend first **reserves the slot in the plugin** (creates the booking there). If the slot was just taken (for example by a website customer), the app asks the customer to pick another. Only then is the job created.
5. From here the flow is the same as 3.1, with in-app tracking and push notifications instead of the web link.
6. The booking appears on the staff desk with the source "App".

### 3.3 Book a dog walk in the app
- Walks stay **app-only and instant** (offered to online walkers nearby, as built). They are allowed only in cities where the plugin's "walking" switch is on, at the plugin's walk-plan prices.
- Each walk is also written into the plugin (as a walk booking) so it appears in the panel and in sales.
- Website "walk requests" stay as leads for the desk to call back.

### 3.4 Reschedule or cancel
| Who | How | Rule |
|---|---|---|
| App customer | In the app | Free up to **4 hours** before the slot. After that, the app asks them to call or WhatsApp the desk. A reschedule must pick a free plugin slot. |
| Website customer | WhatsApp or call the desk (as today) | The desk does it in the panel. |
| Effect on the partner | Reschedule: the assigned partner is asked to reconfirm the new time within 2 hours, otherwise the job is reoffered. Cancel: the partner is told immediately and the job leaves their list. | |
| Money | Online-paid cancellations are refunded through Razorpay by the desk (as today); used points come back, earned points are reversed (plugin already does this). | |

### 3.5 Points, coupons, complaints in the app
- Points balance and history shown in the app; usable at checkout (same rules as the website: minimum 100, up to the plugin's maximum percent).
- Coupons: the same codes as the website.
- Complaints within 24 hours, with photos, go into the plugin's Complaints list; the customer sees the status in the app.

## 4. Partner flows (partner app)

### 4.1 Joining (already built)
Sign up → Aadhaar KYC → tools photos (groomers) → staff approve and choose **My team** or **Freelancer** and the cities they serve.

### 4.2 Getting a job
1. The partner switches **Online**.
2. A new booking in their city (website or app) is offered to every **online, approved partner in that city who handles that pet type**. Their phone rings with the bark ringtone. The offer shows date, time window, area, package, pet (breed, age, **aggression level**), and their **earning**.
3. The **first to accept** gets it. The others see "Taken".
4. If the customer chose a specific partner in the app, only that partner is asked first; if they do not answer within the window, it goes to everyone.
5. **Staff can assign a partner directly** from the desk at any time; the partner gets a "Job assigned to you" notification and must acknowledge it.
6. **Escalation:** if nobody accepts within **2 hours** of booking (or by **6 pm the day before** for next-day jobs, or **within 15 minutes** for same-day jobs), the desk card turns red and the desk gets an alert to assign manually.

### 4.3 Doing the job
1. My Jobs shows the schedule. On the day, tap **Start trip** → the customer gets "on the way" with live tracking; the desk card shows ETA.
2. Navigate (in-app, Ola Maps). Tap **Arrived**.
3. Before photos → ask for the customer's **start code** → **In progress**.
4. Checklist from the package items. After photos.
5. **Payment:** if not paid online, collect cash or UPI and mark it received (amount is shown; a price change by the desk is reflected live).
6. Ask for the **end code** → **Completed**. The plugin booking becomes Completed with the payment mode, so points and the completion WhatsApp go out exactly as when the desk marks it complete today.

### 4.4 Problems
| Situation | What the partner does | What happens |
|---|---|---|
| Can't make it after accepting | "Release job" with a reason | Reoffered to others; desk alerted; repeated releases are tracked for the admin |
| Customer not home / unreachable | "Customer not available" after waiting 15 min, with a photo at the door | Desk alerted to call; desk decides reschedule or cancel (a cancellation fee is a business decision, see 9) |
| Customer wants an extra service | Tells the desk (call) | Desk changes the price in the panel; the new amount appears in the partner app |
| Pet is aggressive / unsafe | "Stop job" with a reason | Desk alerted; desk decides |

### 4.5 Money
- **Online-paid booking:** the company holds the money; the partner's share goes to their payout (as built).
- **Cash or UPI collected by the partner:** the partner owes the commission; it builds up as dues and is settled from payouts or paid online (as built, including the dues limit that pauses new jobs).
- Commission percent per partner, partner discounts, payouts: as built in our admin.
- **My team vs Freelancer** (needs a decision, section 9): team partners might be salaried (no commission split, only a record of jobs done), freelancers on commission.

## 5. Staff flows (the Booking desk, in the WordPress panel)

Staff keep everything they do today (punch in, add bookings by phone, custom packages, discounts, reschedule, cancel, complaints, redo, reports). New:

1. **Every booking card shows the groomer** (name, phone, live status chip, ETA) and the source (Website, App, Phone call).
2. **Assign / change groomer** button on each card: lists partners in that city who are free at that time (with rating and distance), sorted best first. Changing a partner tells both the old and new partner.
3. **Filters:** "No groomer yet", "Running late", "In progress now".
4. **Phone bookings** made at the desk are offered to partners automatically, like website bookings (or assigned directly by the staff member, same screen).
5. **Mark complete at the desk** still works as a fallback (for example if a partner had no internet). It closes the job in the app too, and the desk chooses whether the partner's money is recorded (cash with partner, or online).
6. **Live jobs map** (from "Apps and partners"): every partner on the way or at a job today.
7. Staff in one city only see that city's bookings and partners (as today).

## 6. Admin flows

- Everything in the plugin admin panel stays (settings, cities, prices, coupons, points, staff, reports, events, WhatsApp, store).
- **Apps and partners** section: partner applications and KYC, approve as My team or Freelancer, partner list with filters, commission per partner, discounts, dues and payouts, app customers and pets, app support tickets, insurance requests from the app (shown in the same Insurance leads list).
- **Settings added to the plugin admin:** offer timeout, escalation times, partner cancellation limits, live-tracking on or off, whether app customers can cancel and the cut-off hours.
- **Reports:** website and app bookings together, with a source column; partner performance (jobs, on-time, ratings, releases).

## 7. Example timeline (one website booking)

| Time | Event | Who sees it |
|---|---|---|
| Mon 10:02 | Customer books Full Grooming for Wed 11:30, pay after service | Customer WhatsApp; desk card "Finding groomer" |
| Mon 10:02 | Offer sent to 6 online groomers in Lucknow (bark) | Partner apps |
| Mon 10:09 | Ritika accepts | Desk "Ritika · assigned"; customer WhatsApp "Ritika is confirmed" |
| Wed 10:55 | Ritika taps Start trip | Customer WhatsApp with tracking link and start code; desk "on the way · ETA 25 min" |
| Wed 11:22 | Arrived, start code entered | Desk "In progress" |
| Wed 12:40 | Cash ₹1,699 collected, end code entered | Plugin booking Completed (Cash); points added; completion WhatsApp; Ritika's dues +₹510 |
| Wed 12:41 | Review request | Customer |

## 8. Notifications: who sends what (avoid doubles)

| Message | Website customer | App customer | Partner | Desk |
|---|---|---|---|---|
| Booking confirmed, rescheduled, cancelled, completed, points | Plugin WhatsApp (as today) | Plugin WhatsApp **and** app push | — | Plugin alert (as today) |
| Groomer assigned, on the way, arrived | New WhatsApp templates (sent by plugin on our signal) | App push + in-app tracking | — | Card updates live |
| Job offer, assignment, change, cancellation | — | — | App push with ringtone | — |
| No groomer yet / running late / customer not home | — | — | — | Desk alert + WhatsApp to the alert number |

WhatsApp stays in one place (the plugin's account and templates), so there is one log and one bill.

## 9. Decisions for you to approve

Reply like "1A, 2A, 3B…". **Bold = my recommendation.**

1. **Dispatch:** **A. offer to all eligible partners, first to accept, staff can assign directly at any time**; B. staff always assign by hand; C. automatic assignment to the best partner without asking.
2. **Escalation if nobody accepts:** **A. 2 hours / 6 pm day before / 15 min same-day**, then red flag and desk alert; B. other times (tell me).
3. **Customer chooses a partner in the app:** **A. keep it ("Choose partner"), falls back to everyone if they don't answer**; B. remove it, desk decides.
4. **Website customers see their groomer** (name and tracking link on WhatsApp): **A. yes**; B. only a confirmation, no groomer details.
5. **Start and end codes for website bookings:** **A. yes, sent on WhatsApp** (protects against fake completions); B. only for app bookings.
6. **App customer self-service:** **A. cancel or reschedule free up to 4 hours before**; B. always through the desk; C. different cut-off (tell me).
7. **Partner no-show / customer no-show fees:** **A. none for now, desk decides case by case**; B. define fees now.
8. **My team partners:** **A. salaried: jobs recorded, no commission split, no dues**; B. same commission model as freelancers; C. per-partner choice.
9. **Payments in the app:** **A. same Razorpay account as the website** (one place to reconcile); B. separate account.
10. **Points in the app:** **A. earn and spend, same rules as the website**; B. show only.
11. **Walking:** **A. app-only instant walks, only in cities where the plugin's walking switch is on, at plugin prices**; B. keep walks as callback requests everywhere.
12. **Desk "mark complete" when the partner did the job but the app wasn't used:** **A. allowed, with a note, and the partner's money is recorded**; B. not allowed once a partner is assigned.
13. **Phone bookings by the desk:** **A. offered to partners automatically like website bookings, unless the staff member assigns one**; B. always assigned by hand.

## 10. What I build after you approve (order)

1. Local staging copy of WordPress + WooCommerce + the plugin (Docker), with sample data.
2. Plugin: security fix, revision counter, the Connector (signed endpoints + outgoing events), new booking fields (partner, job status, source), new WhatsApp templates.
3. Backend: linked jobs from plugin bookings, slots and prices from the plugin, writing status and payment back, escalation timers, tracking web page.
4. Partner app: website jobs, aggression and pet notes, "release job", "customer not available", reconfirm after reschedule.
5. Customer app: plugin slots and city prices, points, website history, complaints, reschedule/cancel rules.
6. Panel: groomer on desk cards, Assign / change groomer, filters, live map, Apps and partners section, new settings.
7. End-to-end tests of every row in sections 3 to 6 on staging, then a plan for going live.
