# Plan: everything in the plugin, retire admin web and staff web

**Goal (as given on 18 Nov):** the client and his staff use one panel only, the website's "Wag & Tails" plugin. Our admin web and staff web are not deployed. Only the backend runs on the VPS.

**Status:** draft for approval. Bookings, the desk, groomer assignment, live tracking, cities and prices, coupons, points and complaints are already in the plugin. This plan covers the rest.

## Decisions already made (25 Nov)

1. **One store: WooCommerce.** The app sells the website's WooCommerce products, and app orders land in WooCommerce.
2. **Pet insurance and support tickets** go into the plugin.
3. **Staff and client both** see partners, approve them and see partner money (changed 25 Nov; the first draft said money was for the client only).
4. **The full Aadhaar number and Aadhaar photos are stored** for verification (Part 2b). This replaces the earlier design, which deliberately kept only the last 4 digits.
5. **Groomers buying supplies:** yes, with **one "partner discount %"** for all WooCommerce products, set in the plugin.
6. **Shipping, delivery charge and cash on delivery** in the app follow the website shop's own WooCommerce settings.

## Who sees what

| Plugin page | Client (WordPress administrator) | Staff (plugin staff login) |
|---|---|---|
| Partners: list, approve, city, team/freelancer, suspend | Yes | Yes |
| Partner money: commission, discounts, dues, payouts | Yes | Yes |
| Aadhaar number and photos (masked until "Show" is clicked, every view logged) | Yes | Yes |
| Insurance requests | Yes | Yes |
| Support tickets (chat with customers and partners) | Yes | Yes |
| Customers (website + app, merged by phone) | Yes | Yes |
| Store orders (WooCommerce, app orders included) | Yes | As WooCommerce allows today |
| Activity log | Yes | No |

How it works technically: every new page talks to the backend through the plugin's server, using the signed link that already exists (the same one the desk uses). The browser never gets a backend password, and the plugin checks the WordPress role before every call.

## Part 1: Store (WooCommerce as the only store)

1. **Products in the app come from WooCommerce:** name, photos, variants, price, sale price, category and stock. The backend copies them every 10 minutes and after every order. Products that are hidden or out of stock on the website are hidden in the app too.
2. **App checkout:** the customer pays in the app (Razorpay). The backend then creates the order in WooCommerce as **paid, Processing**, marked "App". Stock goes down in WooCommerce. If the website is unreachable, the order is queued and retried (the same outbox used for bookings), so a paid order is never lost.
3. **Order handling stays in WooCommerce → Orders**, exactly as for website orders today: packing, shipping and status. Status changes are sent back to the app, so the customer sees "Shipped" and "Delivered".
4. **Coupons:** WooCommerce coupons are checked by WooCommerce at app checkout. The app's own store coupons are switched off.
5. **Shipping, delivery charge and cash on delivery:** the app uses the website shop's own WooCommerce settings (read from the site, so they stay the same when the client changes them).
6. **Groomers buying supplies:** the partner app shows the same WooCommerce products with the plugin's "partner discount %" taken off; the order lands in WooCommerce marked "Partner".
7. **The app's old separate catalog is switched off.** Past app orders stay visible in each customer's order history.

## Part 2: Partners page (client)

- List with filters: waiting for approval, active, suspended; by city.
- Partner card: photo, name, phone, city, services, verification (DigiLocker result, last 4 Aadhaar digits only), tools, rating, jobs done, releases, joined date.
- Actions: **Approve** (choose the city exactly as on the website, and Team (salaried) or Freelancer), **Reject** with a reason, **Suspend / Reactivate**, change team/freelancer.
- The partner app's "waiting for approval" screen keeps working; approval now happens here.
- The "Partner panel link" setting added earlier is removed (no separate panel any more).

## Part 2b: Aadhaar number and photos

Today the partner app verifies through DigiLocker and keeps only the last 4 digits; its sign-up screen even tells partners "We never see or store your full Aadhaar number." That changes as follows:

1. **Sign-up (partner app):** DigiLocker verification stays (it proves the Aadhaar is real). After it, the partner enters the full Aadhaar number (it must end in the digits DigiLocker returned) and takes photos of the **front and back** of the card. A consent line says why it is stored and who can see it. The sentence promising we never store it is removed.
2. **Storage (backend):** the number is **encrypted** in the database (AES-256-GCM, key in the VPS `.env`, a different key from everything else). The photos are stored **encrypted in a private folder**, never in the public `/uploads` folder, so they cannot be opened by guessing a link. The existing duplicate check (one Aadhaar per partner account) stays.
3. **Viewing (plugin):** the partner card shows `XXXX XXXX 1234` and blurred photos. **Show** reveals them for that person only. Every reveal is written to the activity log (who, when, which partner).
4. **Backups** contain the encrypted data only. The key is kept separately (password manager); without it the backup copies are unreadable.
5. **Deleting:** when a partner is removed (rejected or left), their Aadhaar data can be deleted from the partner card. The plan proposes automatic deletion 6 months after rejection.
6. **Existing partners** (verified before this change) are asked for the number and photos the next time they open the app; they can keep working meanwhile.

**Legal note (please confirm with the client):** India has strict rules for businesses that keep Aadhaar numbers and copies (the Aadhaar Act and UIDAI's storage rules, and the DPDP Act 2023 for consent). As I understand them, they expect exactly the protections above: encryption, restricted access, logging, consent and deletion. I am not a lawyer; the client should confirm with his CA or lawyer that keeping full numbers is allowed for his business. A safer alternative that UIDAI itself offers is the **masked Aadhaar** (only the last 4 digits visible), but the client has chosen full storage.

## Part 3: Partner money

- **Commission:** default % and per-partner %; partner discounts.
- **Dues** (cash a freelancer collected that belongs to the business): the list, "paid offline" and adjustments, with a reason.
- **Payouts:** what each freelancer is owed; create a payout batch and mark it paid (with a reference number).
- **Reconcile** button and a monthly summary per partner.

## Part 4: Customers (one list)

The plugin's Customers page gains the app side of each customer, matched by phone: app account yes/no, pets, app bookings, store orders and reward points.

## Part 5: Pet insurance requests

Customers fill in the **Pet insurance** form in the app (pet, owner, city, plan type, cover amount). Today these land in the admin web. New plugin page: list (new, contacted, quoted, closed), details, status change with a note, and click to call or WhatsApp. The customer sees the status in the app.

## Part 6: Support tickets

Customers and partners tap **Help** in the app and write a problem; it becomes a ticket with a chat. New plugin page: open / escalated / resolved list, the chat (reply from the panel, with replies showing in the app), status, and escalate (staff → client). A new-ticket alert appears on the dashboard, plus the existing WhatsApp alert number if wanted.

## Part 7: Dashboard and activity

- The plugin dashboard gains app numbers: partners online now, waiting approvals, open tickets, new insurance requests, payouts due.
- **Activity log** page (client only): who approved, suspended or changed money, and when.

## Part 8: Retiring the two panels

- Admin web and staff web are **not deployed**. Their code stays in the repository for now (removing it is a separate clean-up).
- The VPS kit is updated: no admin-web step, and `CORS_ORIGINS` is not needed.
- Anything else that only lives in admin web today is checked page by page before this is marked done (the Settings page and the product sheet import: the import becomes unnecessary because WooCommerce is the catalogue).

## Testing (same standard as before)

- Plugin tests for every new page and route (signed calls, role checks: staff cannot see money, the public cannot see anything).
- Backend end-to-end tests: approve, suspend, payout, app order → WooCommerce order → status back to the app, website down while a paid order is queued, stock running out between cart and payment, two orders for the last item at once.
- Run against the local staging site with WooCommerce and the real product list.

## Open questions

None. Q1–Q3 were answered on 25 Nov (decisions 3, 5 and 6 above).

## Build checklist (approved 25 Nov, "go")

Note: section 6 of `docs/booking-flows-integrated.md` (approved earlier) already listed the "Apps and partners" admin section (partner applications and KYC, commission, dues, payouts, app customers, support tickets, app insurance in the Insurance leads list). The first build tracker left it out. This checklist closes that gap.

- [x] P1 Database: partner reject fields, Aadhaar (encrypted number, private photo files), WooCommerce ids on products/variants/orders, insurance website ref
- [x] P2 Backend panel API (signed, plugin → backend): partners, approve/reject/suspend/type/city, commission, discounts, dues, payouts, tickets, customers, dashboard, activity
- [x] P3 Aadhaar: encryption, private photo storage, partner endpoints, reveal (logged), delete, auto-delete 6 months after rejection
- [x] P4 Insurance: app requests go to the plugin's Insurance leads; status comes back to the app
- [x] P5 Store: WooCommerce catalogue copied to the app; checkout creates the WooCommerce order (coupon, shipping, COD as WooCommerce decides); paid/COD confirmed; status back to the app; partner discount %
- [x] P6 Plugin: panel routes + pages (Partners, Partner money, Support, dashboard numbers, Customers app info, Activity), store connector routes, partner discount setting, insurance status event
- [x] P7 Apps: partner Aadhaar step (new + existing partners), customer store checkout with WooCommerce totals, partner store at discount
- [x] P8 Tests: plugin tests, backend e2e, apps typecheck/bundle; docs and deploy kit updated (no admin web)
