# Going live: website + apps integration

How to switch on the link between the client's WordPress site (wagandtails.in, plugin "Wag & Tails") and the apps' backend on the VPS. Do the steps in order. Nothing changes for website customers until step 5.

Tested on the local staging copy: plugin Connector test 49/49, apps link test 80/80, **84 end-to-end audit tests** (security, concurrency, resilience, business rules, load; see `docs/test-audit-wp-integration.md`), backend unit tests 30/30, panel screens checked in a browser. The plugin changed after the first version of this guide (locks against double bookings, a slot-taken message fix): upload the current `wp-plugin` folder. Phone screens: see `docs/qa-checklist-wp-integration.md`.

## 0. Before you start
- **Back up the website** (Hostinger: full backup, or at least the database). The plugin update adds a `rev` column to the `wp_wt_records` table on the first page load.
- **Pick a secret.** Generate one long random value, for example in a PC terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. The same value goes in two places (steps 1 and 2). Do not send it over WhatsApp or email; paste it directly into each file.
- **Pick a quiet time** (late evening). The steps take about 30 minutes.

## 1. Backend (VPS terminal, in the project folder)
```
git pull
npm ci
cd apps/api
npx prisma generate
npx prisma migrate deploy        # adds 3 migrations: dr_woof_photos (if not yet), wp_config_sync, wp_jobs
npm run build
```
Then add to `apps/api/.env` on the VPS:
```
WP_CONNECTOR_URL=https://wagandtails.in/wp-json
WP_CONNECTOR_SECRET=<the secret from step 0>
PUBLIC_API_URL=https://<your API domain>     # used in the WhatsApp tracking link; must be https
```
Restart: `pm2 restart all` (or the name of the API process). Check: `curl -s https://<API domain>/api/v1/health` shows `"status":"ok"`.

At this point the backend copies the website's price list every 5 minutes (cities, package prices per city, coupons, walk prices). Check it as admin: `GET /api/v1/admin/wp/status` must show `lastError: null` and `pluginVersion`. Until step 2 it shows an error (the website does not know the secret yet); that is expected.

## 2. Website: wp-config.php (Hostinger File Manager, `public_html/wp-config.php`)
Add above the line `/* That's all, stop editing! */`:
```php
define( 'WT_CONNECTOR_SECRET', '<the secret from step 0>' );
define( 'WT_CONNECTOR_URL', 'https://<your API domain>/api/v1/connector/events' );
```

## 3. Website: upload the plugin
WordPress admin → Plugins → Add New → Upload Plugin → the zip of the `wp-plugin` folder (rename the zip to `wag-and-tails.zip`, folder name inside must be `wag-and-tails`) → Replace current with uploaded → Activate if asked. Then open any page of the site once (this runs the small database upgrade).

Check: Admin panel → **Apps & partners** shows the live map without the red "not connected" note.

## 4. First sync and settings (admin panel on the website)
1. Apps & partners → enter the **Partner panel link** (our admin web app URL) and review the rules (defaults are the approved decisions: 10 min for a chosen groomer, 2 h / 6 pm / 15 min escalation, 4 h app cut-off, 2 h reconfirm, 15 min wait at the door, live tracking on).
2. Cities & walking: make sure each city's **walking** switch is right (walks are offered in the app only where it is on).
3. On the backend, as admin: `POST /api/v1/admin/wp/sync`, then `GET /api/v1/admin/wp/status` → `lastError: null`, counts of cities, packages, coupons.
4. In our admin panel, approve partners with the right **city** (spelled exactly as the website city, e.g. "Lucknow", "North Mumbai") and as **My team** (salaried) or **Freelancer**.

## 5. WhatsApp templates (client, Meta Business Manager)
In the website admin panel → Settings → WhatsApp templates, submit the four new templates: **Groomer assigned**, **Groomer on the way** (with tracking link and start code), **Grooming started: end code**, **Booking needs the desk** (alert number). Meta usually approves within a few hours. Until then they show as "Not sent (no template)" in the Notifications log and nothing else breaks.

## 6. Smoke test on the live site (15 minutes, with one real partner phone)
1. Make a website booking for tomorrow with your own phone number, pay after service.
2. Within a minute: the booking desk card shows **Finding groomer**; the partner's phone rings.
3. Partner accepts → desk card shows the groomer's name; your phone gets "groomer assigned" (once the template is approved).
4. Partner taps Start trip → desk card "on the way · ETA"; the WhatsApp link opens the tracking page.
5. Arrived → start code → grooming → collect cash → end code → complete. The desk card shows **Completed · Cash**, points are added.
6. Log into the customer app with the same number: Account → Reward points and Website & phone bookings show it.
7. Book in the app for another slot: it appears on the desk with source **App**.
8. On the desk, Assign groomer on a booking, Change groomer, then Cancel it: the partner app updates each time.

## 7. Apps
Build and publish new app versions (customer and partner) with the new screens (EAS build as usual). The backend works with the old app versions too: they keep their old flow, but only the new versions show website slots, city prices, points, website history and complaints, and the partner problem buttons.

## Switching it off (rollback)
- Quick: remove the two lines from the VPS `apps/api/.env` (`WP_CONNECTOR_URL`, `WP_CONNECTOR_SECRET`) and restart. The apps run on their own again; the website runs as before. Nothing is deleted.
- Website side: remove the two `define` lines from wp-config.php. The plugin keeps working exactly like 1.13 (the Connector refuses calls and sends nothing).
- To return to the old plugin: upload the 1.13.0 zip. The extra `rev` column is harmless.

## What to watch in the first week
- `GET /api/v1/admin/wp/status`: `outbox.failed` must stay empty (writes to the website that gave up). A failed row can be resent with `POST /api/v1/admin/wp/outbox/:id/retry`.
- Desk filter **Needs attention**: escalations, releases, customers not at home.
- Partner **releases** (shown in the Assign list and the admin partner list).
