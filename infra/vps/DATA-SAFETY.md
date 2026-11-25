# Keeping the live website's data safe

The client's website (WordPress + the "Wag & Tails" plugin) is live and holds real bookings, customers and money records. This page says what could go wrong, what protects the data, and the exact order to work in.

## 1. What the update actually does to the website's data

| Question | Answer |
|---|---|
| Does uploading the new plugin delete anything? | No. WordPress replaces the plugin's **files** only. The data lives in the database table `wp_wt_records` (and the options `wt_config`, `wt_db_ver`), which the update does not touch. |
| Does the plugin change the table? | One small, additive change on the first page load after the update: a new column `rev` (default 0) and one index. No row is changed or removed. (`WT_DB_VER` 1 → 2, `dbDelta`.) |
| Does anything reach the backend straight after the upload? | No. The Connector is **off** until two lines (`WT_CONNECTOR_SECRET`, `WT_CONNECTOR_URL`) are added to `wp-config.php`. Until then the plugin behaves like the old version. |
| Can the website lose data if the backend is down? | No. The website keeps its own records; the backend is only told about new events, and the backend keeps retrying writes for about half a day, and the plugin is the source of truth. Both sides keep working alone. |
| Which website data is copied to the backend once linked? | What is needed to dispatch a groomer: booking details, customer name, phone, address, pet name, package, price and status; prices and cities are read the other way (website → backend). Payment-card data never exists on either side (Razorpay holds it). Nothing is copied before you add the secret. |
| Is the traffic protected? | Yes: HTTPS only, and every call is signed (HMAC-SHA256 with a shared secret, timestamp, one-time nonce). A call without the right signature is refused, and a recorded call cannot be replayed. |

## 1b. Aadhaar numbers and photos of partners

Stored on the VPS, never in WordPress. The number is encrypted in the backend database and the photos are encrypted files in a private folder; the plugin shows them only when a logged-in owner or staff member clicks **Show**, and each click is written to the Activity log. WordPress backups and the website's database never contain them. The VPS backups contain only the encrypted forms; the key (`AADHAAR_ENC_KEY`) is kept separately and must be saved in a password manager.

## 2. Rules that keep it secure

1. **Back up before touching the website.** Two copies: the Hostinger full backup/snapshot **and** a database export you download (phpMyAdmin → Export → Quick → SQL). Keep the downloaded file on your PC; a backup that only lives on the same server is not a backup.
2. **Count before and after.** In phpMyAdmin run (replace `wp_` if the site's prefix differs):
   `SELECT type, COUNT(*) FROM wp_wt_records GROUP BY type;`
   Save a screenshot. After the update the same query must show the same numbers (the same or more only if customers booked in between).
3. **One change at a time, with a pause:** (a) backend on the VPS, (b) plugin upload, (c) wp-config lines. Check after each. Never combine them.
4. **Quiet hour:** late evening, not during a sale or the morning rush.
5. **The secret** (`WT_CONNECTOR_SECRET` = `WP_CONNECTOR_SECRET`) is generated once, pasted directly into the two files, never sent by chat or email, never put in the Git repository. Anyone who has it can talk to the website's booking desk.
6. **The VPS database and Redis are closed to the internet** (the setup script does this; the firewall opens only 22, 80, 443). The admin account of the backend should use a long password.
7. **Never run the tests or experiments against the live site.** Tests use the local copy only.

## 3. Order of work (nothing touches the live website until step D)

**A. Backend alone on the VPS** (README steps 1–6). The website is not involved. If something is wrong here, the live site cannot be affected.

**B. Take the backups** (rule 1), save the counts (rule 2).

**C. Optional but recommended: a rehearsal on a copy.** Import the database export into the local staging site (`infra/wp-staging`) or a Hostinger staging copy if the plan offers one, upload `wag-and-tails.zip` there, open a page, and check the counts are identical. This is the same upgrade the live site will get, done where it cannot hurt.

**D. Upgrade the live plugin.**
1. WordPress admin → Plugins → Add New → Upload Plugin → `wag-and-tails.zip` (built by `build-plugin-zip.py`) → **Replace current with uploaded**.
2. Open the website home page once, then the plugin's admin page.
3. Run the count query again. Same numbers? Open a few old bookings in the admin panel: details intact? Make a test booking on the booking page and cancel it. The site is now on the new plugin with the Connector still **off**.

**E. Link the two sides.** Add the two `define` lines to `wp-config.php` (README step 9), add the two `WP_CONNECTOR_*` lines on the VPS and restart. Then `GET /api/v1/admin/wp/status` must show `lastError: null`.

**F. Smoke test with one real partner phone** (docs/deploy-wp-integration.md, section 6), then watch the first week.

## 4. If something looks wrong (rollback, any time)

| Problem | Fix | Data lost? |
|---|---|---|
| Link misbehaves | Remove the two `define` lines from `wp-config.php`. The plugin is back to old behaviour at once. Optional: comment the two `WP_CONNECTOR_*` lines on the VPS and `sudo systemctl restart wag-api`. | No |
| New plugin shows an error | Upload the old 1.13.0 zip (Replace current). The extra `rev` column is harmless. | No |
| Records changed or missing (should not happen) | Restore the database export from rule 1 through phpMyAdmin → Import, or restore the Hostinger backup. | Only bookings made after the backup, which you re-enter from the Notifications log / payment dashboard |
| Backend broken after an update | `bash /opt/wag/restore.sh /opt/wag/backups/db-<latest before the update>.dump` | Only data since that backup |

## 5. Ongoing

- The backend backs itself up every night (14 days kept, and before each deploy). Copy the backups off the server: Hostinger's weekly VPS backup/snapshot is a second layer; for a third, set up `offsite.conf` (README, "Backups").
- Updating the plugin later: repeat B and D.
- Keep `AADHAAR_HASH_PEPPER`, `JWT_*` and the connector secret in a password manager. Losing the pepper makes stored KYC hashes useless.
