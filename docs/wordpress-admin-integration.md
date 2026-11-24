# Wag & Tails: one panel for the website and the apps

Status: decision paper, version 4. Rewritten after reading the source code of the client's WordPress plugin (`/wp-plugin`). Nothing here is built yet.
Written for: you, and the client if you want to share it. Technical terms are explained where they first appear.

## 0. The short version

- I read all of the plugin, `wag-and-tails` v1.13.0 (about 12,000 lines). It is one self-contained system: booking engine, booking desk, admin panel, customer accounts, rewards points, WhatsApp automation, complaints, events and passes, insurance leads, plus hooks into WooCommerce and Razorpay.
- **Correction to what I told you earlier:** the client's "Booking staff" are the office staff who take bookings on the phone (telecallers). They are not groomers. The plugin has **no groomer concept at all**: a city just has a number called capacity ("how many groomers can work at once"). So the website has never assigned a booking to a named groomer. That is exactly what our partner app adds, and it is the biggest practical opportunity.
- The plugin is well organised and safe to extend. All data changes pass through three small functions, which gives us one clean place to send changes to our backend.
- I found a few security and robustness issues in it (section 5). One is worth fixing soon: anyone who knows a booking ID can read that booking's customer details.
- **Recommendation:** keep their panel as the one panel staff use. Add a small **Connector** module to the plugin, plus a new sidebar group "Apps and partners". Our NestJS backend stays the brain for the partner and customer apps (dispatch, tracking, KYC, payouts). The two systems exchange bookings, customers and points through the Connector, using the customer's phone number as the common key.

## 1. What the plugin is

### 1.1 Files

| File | What it does |
|---|---|
| `wag-and-tails.php` | Starts the plugin: creates the data table, the "Booking Desk" role and the app page |
| `includes/config.php` | All business settings in one WordPress option: cities, packages and city prices, breeds, coupons, insurance form, walk plans, banners, rewards rules, payment and WhatsApp settings |
| `includes/records.php` | Storage: one table for everything, plus the reward-points ledger |
| `includes/bookings.php` | Price calculation, website booking, the booking desk's actions (complete, cancel, reschedule, discount, edit, redo, delete) |
| `includes/slots.php` | Which time slots are free; coupon rules; the WhatsApp delivery-status webhook |
| `includes/blocks.php` | "Leave and holidays": blocks days or time windows per city |
| `includes/rest.php` | The main REST API (`/wp-json/wt/v1/...`) |
| `includes/customers.php` | Customer directory, customer profiles with pets, login with a WhatsApp code |
| `includes/reports.php` | Sales dashboard numbers, CSV reports, staff attendance (punch in and out), monthly targets and milestone rewards, "loyal customer" gifts |
| `includes/notify.php`, `watemplates.php`, `wabulk.php` | Email and WhatsApp (Meta Cloud API) messages, template sync, bulk sending |
| `includes/campaigns.php` | Reminder campaigns for customers due a groom |
| `includes/events.php` | Events and passes (sold through Razorpay), broadcast to customers |
| `includes/complaints.php` | Complaints, with a 24-hour window and a free "redo" visit |
| `includes/woo.php` | WooCommerce: catalogue endpoint, using and earning reward points on store orders |
| `includes/frontend.php`, `skin.php`, `templates/app.php` | The full-screen page the whole app lives in, scripts, and the WordPress menu entry |
| `includes/import-bookingpress.php` | One-off import from the older BookingPress plugin |
| `assets/app.js` (2,713 lines), `app.css` | The entire front end: a hand-written single-page app (no framework) that draws the booking site, the desk and the admin panel |

### 1.2 How data is stored
Everything lives in **one table, `wp_wt_records`**, with the columns `type`, `ref`, `phone`, `city`, `status`, `skey` (a date-time sort key), `amount`, `data` and timestamps. The real content is a block of JSON in `data`. The record `type`s are: `booking`, `points`, `customer`, `cprof` (customer profile), `walk`, `insurance`, `enquiry`, `complaint`, `attend` (attendance), `notif` (message log) and event/pass types.

Consequences:
- Adding a field to a booking needs no database change (good for us).
- Only phone, city, status, sort key and amount can be searched in the database. Everything else is filtered in PHP after loading rows (slow if the data grows a lot).
- There is no "last changed" index, so nothing can efficiently ask "what changed since yesterday". We must add one.

### 1.3 Who can do what

| Role | How they sign in | Can do |
|---|---|---|
| Administrator | WordPress login | Everything, including settings, staff and admin logins, deleting bookings |
| Booking Desk (`wt_desk`) | A staff login made in the admin panel | The desk: add, complete, reschedule, cancel bookings, customers, complaints. Scoped to one city or all. Must **punch in** each day when attendance is switched on |
| Customer | Mobile number plus password, or a **WhatsApp one-time code** | Book, see history, points, complaints, passes |

The customer's identity is their **10-digit mobile number** (it is also their WordPress username). That is the same key our apps use.

### 1.4 The REST API today (`/wp-json/wt/v1/`)
- **Public:** create a booking, verify a payment, free slots, blocked days, coupon check, product catalogue, events, walk request, insurance enquiry, contact form, register, login, WhatsApp code send and verify, WhatsApp delivery webhook.
- **Customer (logged in):** my account, profile, passes, complaints.
- **Desk (staff or admin):** booking list and actions, clients, complaints, attendance punch, reports.
- **Admin only:** save settings, list and edit leads, customers with points, adjust points, staff and admin logins, dashboard, events, broadcast, reminders, campaigns, templates, blocks, team targets.

## 2. How a booking works today

1. The customer picks a city, package, pet details (type, breed, gender, age, **aggression level**), address with a **map pin**, date and a time slot, then pays online (Razorpay) or chooses pay after service. Optional: coupon, reward points, add-on products from the store.
2. The server recomputes the price (city price, add-ons, coupon, points). Statuses are **Pending payment, Confirmed, Rescheduled, Completed, Cancelled**. An unpaid online booking holds its slot for 20 minutes.
3. Slots come from **capacity**: a slot is free while the number of overlapping bookings is below the city's capacity. Day start and end, step, buffer between jobs and lead time are settings. "Leave and holidays" reduces capacity for days or hours.
4. Confirmation goes to the customer by email and WhatsApp, and an alert goes to the business's WhatsApp number.
5. Staff can also **add bookings by phone** at the desk, including **custom packages** (own name, price and duration, as free text) and custom times. This is how things like "For 2 pets, trimming..." in your screenshot are created. Multi-pet is just text in the custom package name, not a structured feature.
6. At the desk a booking is **completed** by recording how it was paid (Online or Cash). Cancelling needs a reason. Discounts and price changes need a written reason and are logged. Reward points are earned on completion and reversed on cancellation.
7. Within 24 hours of a completed groom the customer can raise a complaint, and the desk can book a **free redo** visit.

What a booking record holds (the useful fields): reference (`WT-XXXXXXX`), city, package or custom package, pet type, breed, gender, age, aggression, customer name, phone, email, address, pincode, latitude and longitude, date, start time, slot label, minutes, subtotal, coupon, discount, points used, total, status, payment status (Due or Paid), payment mode, who added it (`by`) and from where (`source`, for example Website or Phone call), notes, and history logs.

## 3. What this means for the integration

1. **Booking staff are not groomers.** There is no list of groomers and no assignment. This is the gap our partner app fills: a website booking can be offered to partners in the app, accepted by one, tracked, completed and paid out. Staff attendance and targets in the plugin concern the office team and have nothing to do with partners.
2. **Capacity is a number the client sets by hand.** Later, our partner availability could feed it, so slots reflect who is actually working.
3. **One choke point.** Every booking write goes through `wt_rec_insert`, `wt_rec_save` and `wt_rec_delete`. A single hook there reports any change, whichever screen caused it (website, desk, admin, import).
4. **Bookings are free-form JSON.** We can add fields such as `partnerId`, `partnerName`, `partnerPhone`, `appJobId`, `source = App` without a migration.
5. **The phone number matches our customers.** Our customer app logs in by phone, the plugin identifies customers by phone. Matching is simple: the last 10 digits.
6. **Pets are not real records on the website.** A booking stores pet type, breed, gender, age and aggression only. A customer's saved pets live in the profile (`cprof`, up to 10, with names). In our system pets are full records with medical history, so we must map them.
7. **WhatsApp is already set up** through Meta's Cloud API, with approved templates for booking, reschedule, cancel, complete, points, OTP and more. Our apps can reuse the same account for messages and the customer login code instead of a new SMS provider (subject to Meta's rules for templates).
8. **There is a free public product catalogue** at `/wp-json/wt/v1/products` (138 products with sizes, breeds and stock). Our app store can read it as is.
9. **The existing API is not suited to server-to-server use.** It signs in with a browser cookie and nonce, the desk side requires the user to have punched in, the admin routes are all-powerful (changing settings, deleting bookings), lists are capped at 300 or 500, and there is no "changed since" filter. We should add a purpose-built Connector module rather than log a robot in as an administrator.
10. **The panel's menu is a plain array in `app.js`** (`TABS`) with one function per screen. Adding an "Apps and partners" group is a small, low-risk change.

## 4. Where our system and theirs overlap

| Area | Their plugin | Our backend | Decision |
|---|---|---|---|
| Grooming bookings | Single pet, slot from capacity, no groomer | Single pet, dispatch to partners, tracking | Shared record, linked by reference (section 6) |
| Customers | Phone is the key; profile with pets; points | Users by phone; pets with medical records | Merge by phone; each side keeps its extra data |
| Reward points | A points ledger | None (wallet removed) | Plugin is the master; apps show balance and can earn and spend through the Connector |
| Cities and prices | 10 cities, city price per package, capacity, walking on or off | 3 cities, one price list | Plugin is the master; backend reads it |
| Coupons | Coupon rules with visibility | Coupon rules | Plugin is the master for website coupons; decide for the app |
| Store | WooCommerce, 138 products, orders, Razorpay one-click checkout, shipping through Shiprocket | Separate small store | WooCommerce is the master (below) |
| Insurance | Configurable form; leads list | Our form and list | One list; our form matches theirs (below) |
| Complaints and redo | Yes | Support tickets only | Phase 2: show in the customer app |
| Events and passes, campaigns, broadcasts, reminders, attendance, targets, reports | Yes | No | Stay in their panel, nothing to copy |
| Partners, KYC, dispatch, live tracking, commission, payouts | None | Yes | Added to their panel as the new "Apps and partners" group |

### Store
Keep **WooCommerce as the owner** of products, prices, stock and orders. The customer app reads products from `/wt/v1/products`. For in-app checkout there are two options, and the client should choose: (a) create orders in WooCommerce from our backend and pay through a Razorpay link or cash on delivery; (b) send the customer to the website's checkout for payment. Running two catalogues will eventually cause stock and price differences, so I recommend not keeping our own store tables once the app reads from WooCommerce.

### Insurance
Their form is already defined in settings. Its questions are: pet parent name, phone, email, city, pet name, pet type, breed, pet age, existing medical conditions, cover type (Accident and illness, Comprehensive, Not sure yet). Our app form should ask the same questions, and submissions from the app should land in the same "Insurance leads" list through the Connector.

## 5. Review of the plugin's code

Overall it is competent: consistent `wt_` naming, input cleaned everywhere, database queries prepared, prices recalculated on the server, Razorpay signatures checked, rate limits on the WhatsApp login code, cache disabled on live data. What I would fix or watch:

| Finding | Why it matters | Suggested fix |
|---|---|---|
| **Booking lookup leaks personal data.** The public `POST /bookings/verify` returns the whole booking (name, phone, email, address, map pin) to anyone who supplies a booking reference of a confirmed booking, without proving who they are. References are hard to guess but they are sent in emails, WhatsApp messages and often shared. | Privacy exposure of customers | Require the payment signature or the phone number, and return only what the payment screen needs |
| Staff and admin logins have no attempt limit of their own (only WordPress defaults) | Admin accounts hold the payment keys and all customer data | Add login throttling and consider two-step login for admins |
| The WhatsApp delivery webhook accepts any POST without checking Meta's signature | Someone could forge delivery statuses in the log | Verify Meta's `X-Hub-Signature-256` header |
| The Razorpay secret and WhatsApp token are stored in plain text in a WordPress setting | Anyone with database or admin access can read them | Move to `wp-config.php` constants |
| **Lost updates.** The desk reads a whole booking, changes it and saves the whole thing back. Two people (or a person and our Connector) acting at the same moment can silently overwrite each other. | Matters as soon as a second system writes to bookings | Add a revision counter and refuse a save made on an older revision |
| **Scaling.** Dashboards and customer lists load whole tables into PHP (up to 20,000 profiles). Fine today, slow as data grows. | Slower panel over time | Add an index and date filters; paginate |
| Third-party scripts (Leaflet, Chart.js, Google Fonts) load from public CDNs with no integrity check | Small supply-chain risk | Self-host or add integrity hashes |
| No automated tests; the front end is one 2,700-line file; readme says version 1.11.3 while the plugin is 1.13.0 | Harder to change safely | Add tests around the money logic before we touch it |

I would send the first finding to whoever maintains the plugin as soon as we know who they are. I have not tested it against the live site and have not tried to use it.

## 6. Recommended design

Their admin panel stays the one panel staff use. We extend the plugin and add our modules to it.

```
Website visitors ─► WordPress: plugin (bookings, points, leads) + WooCommerce  (unchanged for visitors)
                          │ ▲
     signed events        │ │  signed requests from our backend
     (booking created /   ▼ │  (create app booking, assign partner, change status,
      changed, customer,    │   points, leads, read config and orders)
      order, lead)       CONNECTOR (new module inside the plugin)
                          ▲
                          │
Customer app ─┐           ▼
Partner app  ─┼──►  NestJS backend (VPS) ──► partners, dispatch, tracking, KYC, payouts
              ┘                   │
                                  └──► embedded "Apps and partners" screens inside their panel
```

### 6.1 Who owns what

| Data | Owner | Other side |
|---|---|---|
| Website booking page, store, events, campaigns, WhatsApp, reports, attendance, targets | The plugin | Not copied |
| Cities, packages and city prices, capacity, holidays, coupons, rewards rules | The plugin (settings) | Backend reads them on a schedule |
| Bookings | The plugin's record is the business record. The backend keeps a linked job for every booking that needs a partner | Linked by reference; status flows both ways |
| Customers and points | The plugin (phone is the key) | Apps read points and customer details through the Connector |
| Partners, team or freelancer, KYC, dispatch, tracking, commission, payouts | Our backend | Shown in their panel |
| Pets, medical records, vaccinations, reminders, Dr. Woof, push | Our backend | Pets summarised back into the customer profile so staff can see them |
| Store products, stock, orders | WooCommerce | App reads and creates orders through it |
| Insurance leads | The plugin's list | App submissions go into it |

### 6.2 The Connector module (inside the plugin)
A new file, for example `includes/connector.php`:
- **Sign-in:** every request carries a signature made with a shared secret over the time and body (so it cannot be replayed), plus an allowed-address check for our VPS. This avoids giving a program an administrator login, and avoids hosting setups that strip login headers. The secret lives in `wp-config.php`.
- **Read endpoints:** bookings and customers changed since a given time (with paging), the current business config, points balance, product list, Woo orders.
- **Write endpoints:** create a booking from the app (safe to repeat, keyed by our booking id), assign a partner, change status (accepted, on the way, arrived, started, completed with how it was paid), add or spend points (safe to repeat), submit a lead.
- **Outgoing events:** a small hook on `wt_rec_insert`, `wt_rec_save` and `wt_rec_delete` queues a signed message to our backend whenever a booking, customer or lead changes. WooCommerce already bundles a reliable background queue (Action Scheduler) with retries, so a failed delivery is retried and never blocks the booking.
- **Database change:** an index on the last-changed time, and a revision number on bookings to stop two writers overwriting each other.

### 6.3 What happens to a booking
1. **Website booking:** customer books on the site, the plugin saves it, the Connector tells our backend. The backend creates a linked job (source: Website) and either offers it to partners in the city or waits for a desk person to assign one.
2. **Partner acts in the app:** accepts, goes on the way, arrives, completes. Each step is sent to the plugin, which updates the same booking: groomer name and phone appear on the desk card, status becomes Completed, and payment (online or cash collected by the partner) is recorded, so points, WhatsApp messages and sales reports behave as they do today.
3. **App booking:** the customer books in the app, the backend creates the job and writes a booking into the plugin (source: App), so the desk, dashboard, sales and customer history all include it and capacity and clashes are respected.
4. **Staff action at the desk** (reschedule, cancel, discount): the plugin saves it and tells our backend, so the partner and customer apps update.

### 6.4 The new sidebar group "Apps and partners"
Added to the `TABS` list in `app.js`. Entries: **Partners** (team and freelancers, approve with a type), **Partner KYC**, **Live jobs and map**, **Payouts and commission**, **App customers and pets**, **App support**. Two ways to build each screen:
- **Embed our existing staff and admin screens** (fastest, nothing thrown away). They would load inside the panel with a one-time signed link. This needs our panels to allow embedding from the client's domain only (today they refuse all embedding), and it is cleaner if our panels sit on a subdomain of the client's site, for example `ops.wagandtails.in`, with the API on `api.wagandtails.in` instead of the current temporary address.
- **Native cards inside the desk** for the things staff do all day: on each booking card, the groomer's name and a live status chip, and an **Assign partner** button that lists available partners in that city. These are small and are best done in the plugin's own interface.

### 6.5 App changes this brings
- **Customer app:** cities and prices come from the plugin settings (10 cities, city price); show the points balance and let points be spent; show website bookings by phone in the history; add complaints and redo; align the insurance form with theirs; read the store from WooCommerce.
- **Partner app:** website jobs appear like app jobs; show the customer's pet notes and aggression level; cash collected is recorded against the booking.
- **Backend:** a `source` and an `externalRef` on bookings; a price per city for each package; custom (staff-made) packages on a booking; a job feed from the Connector; city and holiday awareness in dispatch.
- **Customer login by WhatsApp code** could use their existing WhatsApp account instead of a new SMS provider.

## 7. Options considered

| Option | Result | Verdict |
|---|---|---|
| **A. Extend their panel with a Connector and our modules (this paper)** | One panel for staff, nothing lost, partner app finally connected to website bookings | **Recommended** |
| B. Make our panel the one panel and rebuild their features | Months of work to reproduce the dashboard, reports, attendance, targets, events, WhatsApp, store admin; staff retrain | Not recommended |
| C. A shortcut menu only | Cheap; but bookings and customers would stay in two places | Only as a quick first step |
| D. Replace their booking engine and store with our backend | Cleanest end state, riskiest, slowest | Possible later, not now |

## 8. Phased plan

| Phase | What | Rough effort* |
|---|---|---|
| 0 | Set up a **local staging copy** of WordPress, WooCommerce and this plugin (we have Docker), with sample data, so nothing touches the live site. Confirm the live site runs exactly this code. Agree the questions in section 9 | 2 to 3 days |
| 1 | Plugin hardening: fix the booking lookup leak, add the revision counter and last-changed index; test around the money logic | 3 to 5 days |
| 2 | Connector module in the plugin: signed read and write endpoints, outgoing events with retries | 6 to 9 days |
| 3 | Backend: ingest website bookings and customers as linked jobs; write status and partner details back; reconcile cities and prices | 7 to 10 days |
| 4 | Panel: desk card shows groomer and live status; **Assign partner**; the "Apps and partners" group with embedded screens; subdomain and single sign-on link | 6 to 9 days |
| 5 | Apps: city prices, points, website bookings in history, insurance form alignment, WooCommerce catalogue | 8 to 12 days |
| 6 | Optional: complaints and redo in the customer app; capacity from partner availability; website booking form talks to our backend | to be scoped |

*Gut-feel ranges for one developer. They are placeholders, not a quote. They are firmer than version 3 because I have now read the code, but still unconfirmed against live data and hosting.

## 9. Decisions the client must make

1. **How are groomers assigned today?** Off the system (phone calls, WhatsApp groups)? Will the partner app replace that for all cities or start with some?
2. **Dispatch style:** desk staff assign a named partner, or offer to all partners in the city and the first to accept gets it (as in the app), or both?
3. **Are partners employees, freelancers or both?** (Our approval screen supports "My team" and "Freelancer".)
4. **Cities:** the apps launch in which of the 10 website cities? (Our apps know only Kanpur, Lucknow and Delhi.)
5. **Cash and online payments:** when a partner collects cash, who is owed what? The plugin records a payment mode only. Commission and payouts are in our backend, so the accounting must be agreed.
6. **Reward points:** should app customers earn and spend them? (Recommended, since customers already have balances on the website.)
7. **Store in the app:** read from WooCommerce and place orders there (recommended), or keep a separate store?
8. **Who maintains the plugin** now, and who owns the live site and hosting? We need them for the security fix and the Connector.
9. **Walking:** the website has it off everywhere. Is it launching, and at which price?

## 10. Risks

- **Live revenue system:** all work happens on a staging copy first. The live plugin is updated only after testing, with a backup and a rollback.
- **Two writers on one booking:** handled by the revision counter and by keeping one record per booking.
- **WordPress hosting limits:** background jobs and web requests have time limits on shared hosting. Retries and small batches keep it safe; a slow or down website must never block the apps.
- **Money:** website payments (Razorpay) and partner-collected cash must reconcile in one place. The accountant should review the design.
- **Data protection:** phone numbers, addresses and pet records move between systems. The client should confirm consent and that the privacy policy covers the combined data (India's Digital Personal Data Protection Act).
- **Plugin dependence:** without someone who can ship plugin updates, the Connector cannot be deployed. We would then fall back to reading what the plugin exposes today and living with two panels longer.
- **What I did not verify:** I only read the code. I did not run it, did not see the live data, and I only skimmed `import-bookingpress.php`, the event pass logic and the WhatsApp template tools.

## 11. What I suggest next

1. Tell me whether to go ahead with **phase 0**: a local staging copy (WordPress, WooCommerce, this plugin, sample data) that we both use for everything else.
2. Find out who maintains the live plugin and hosting, and share the security finding (section 5, first row) with them.
3. Get answers to section 9, especially questions 1 to 4. They decide how the Connector and the dispatch screens are shaped.
4. Meanwhile I can prepare the shared design: the exact list of Connector endpoints, the message formats and the new database fields, for you and the client to approve before any code is written.
