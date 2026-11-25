# Deploying the backend on a Hostinger VPS: step by step

Written for someone who has never deployed a server. Every command says **where** to run it:

- **[PC]** = Windows terminal on your computer, in the project folder `wag-and-tails`.
- **[VPS]** = the server's terminal (Hostinger's "Browser terminal" button works, no software to install).

## What goes where

| Part | Where | Notes |
|---|---|---|
| Backend API (+ database, Redis, uploads, encrypted Aadhaar files) | **The VPS** (this guide) | The only thing on the VPS |
| The panel (partners, payouts, support, store orders, bookings, everything) | **The client's WordPress site, in the Wag & Tails plugin** | The client and his staff use only this. There is no separate admin web or staff web any more |
| Customer + partner apps | Phones (EAS build) | Must be rebuilt once with the new API address |

So it is **not** only "deploy backend + install plugin". The full list is: backend on the VPS, domain + HTTPS, move old data (if any), new app builds, then the plugin and the link. The steps below are in the safe order.

## Step 0: what you need (10 minutes)

1. **A domain name for the API**, for example `api.wagandtails.in`. HTTPS (the padlock) is required by phones and by the website, and it needs a real name. In the place where the domain's DNS is managed (Hostinger → Domains → DNS, or wherever it is registered) add an **A record**: name `api`, points to the VPS's IP address (shown in hPanel → VPS). Wait ~10 minutes.
2. **Commit and push the code** [PC]: the VPS downloads the code from GitHub, so everything must be pushed first (`git add`, `git commit`, `git push`). The repository is private, so step 2 gives the server a read-only key.
3. **In hPanel**: VPS → set the operating system to **Ubuntu 24.04 (plain, no control panel)**, choose a data centre in **India** if offered, and set the root password. Note the IP address.

## Step 1: log in to the VPS

hPanel → your VPS → **Browser terminal**. You are `root`. (Or from the PC: `ssh root@<ip>`.)

## Step 2: copy the kit to the VPS and run the setup (about 10 minutes)

The kit is the folder `infra/vps` of the repository. Easiest way to get it on the server, **[VPS]**:

```
apt-get update && apt-get install -y git
git clone --depth 1 https://github.com/abhishek261002/wag-and-tails.git /root/kit
```
If GitHub asks for a login (private repository), do this instead **[PC]** (one line, from the project folder, replace `<ip>`):
```
scp -r infra/vps root@<ip>:/root/kit
```
then **[VPS]**:
```
bash /root/kit/infra/vps/setup-server.sh api.wagandtails.in
```
(or `bash /root/kit/setup-server.sh ...` if you used `scp`). Use your real API domain.

It installs and configures everything: firewall, swap, Node 22, PostgreSQL with PostGIS, Redis, automatic HTTPS (Caddy), the API service, the nightly backup, and creates random passwords and secrets for you (stored in `/opt/wag/.secrets`, never shown). At the end it prints a **deploy key**: a line starting with `ssh-ed25519`.

Add it to GitHub: repository → Settings → **Deploy keys** → Add deploy key → paste, leave "Allow write access" **off**.

## Step 3: first deploy (about 5–10 minutes) **[VPS]**

```
bash /opt/wag/deploy.sh
```
It downloads the code, installs, creates the database tables, builds and starts the API. It ends with `OK: the API is running.`

Test from anywhere, even your phone browser: `https://api.wagandtails.in/api/v1/health` should show `"status":"ok"`.

## Step 4: your settings

On the VPS, `nano /opt/wag/app/apps/api/.env` (save with Ctrl+O, Enter, Ctrl+X), then `sudo systemctl restart wag-api`.
Things to set:
- Keys when you have them: `OLA_MAPS_API_KEY`, Razorpay, etc. (see the comments in the file).
- Do **not** add `WP_CONNECTOR_*` yet.

## Step 5: move the old server's data (only if real users/bookings exist there)

The apps now use the old server `109-122-56-39.sslip.io`. If it holds real data you want to keep:

1. **[old server]** `pg_dump -Fc <its database name> > /tmp/old.dump` (use its own DB user/password), also zip its `uploads` folder.
2. Copy `old.dump` to the new VPS: `scp /tmp/old.dump root@<new-ip>:/root/` (from the old server).
3. **[new VPS]** `bash /opt/wag/restore.sh /root/old.dump` (then re-add the `uploads` folder contents into `/opt/wag/uploads` and `chown -R wag:wag /opt/wag/uploads`).

The restore also applies the three new migrations. If there is no real data, skip this step.

## Step 6: nothing to do for the old admin web

The old admin web and staff web are retired. Partner approval, payouts, support tickets, insurance requests and store orders are all inside the plugin (Step 8 and 9). If the old admin web is still on Vercel, you can pause or delete that project; the backend does not need it.

## Step 7: the apps

In `apps/customer-mobile/eas.json` and `apps/partner-mobile/eas.json` set `EXPO_PUBLIC_API_URL` to `https://api.wagandtails.in/api/v1` and make new builds (your usual EAS process). Old app versions keep pointing at the old server, so keep the old server running until people have updated.

## Step 8: the website plugin (read `DATA-SAFETY.md` first)

1. Back up the website and save the record counts (DATA-SAFETY, rules 1–2).
2. **[PC]** `python infra/vps/build-plugin-zip.py` → makes `infra/vps/wag-and-tails.zip`.
3. WordPress admin → Plugins → Add New → Upload Plugin → that zip → **Replace current with uploaded**. Open the home page, then re-run the count query. Same numbers? Continue.

## Step 9: link the website and the backend

1. **[PC]** make the shared secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. **[VPS]** in `/opt/wag/app/apps/api/.env` remove the `#` in front of the two lines and fill them in:
   `WP_CONNECTOR_URL=https://wagandtails.in/wp-json` and `WP_CONNECTOR_SECRET=<the secret>`; then `sudo systemctl restart wag-api`.
3. Hostinger File Manager → `public_html/wp-config.php`, above the line `That's all, stop editing!` add:
```php
define( 'WT_CONNECTOR_SECRET', '<the same secret>' );
define( 'WT_CONNECTOR_URL', 'https://api.wagandtails.in/api/v1/connector/events' );
```
4. Continue with `docs/deploy-wp-integration.md` from section 4 (first sync, settings) and the smoke test in section 6.

## Everyday commands **[VPS]**

| What | Command |
|---|---|
| Update to the newest pushed code | `bash /opt/wag/deploy.sh` |
| Is it running? | `sudo systemctl status wag-api` |
| See the log (last 100 lines) | `sudo journalctl -u wag-api -n 100 --no-pager` |
| Live log | `sudo journalctl -u wag-api -f` (Ctrl+C to stop) |
| Restart | `sudo systemctl restart wag-api` |
| Backup now | `sudo -u wag /opt/wag/backup.sh` |
| Put a backup back | `bash /opt/wag/restore.sh /opt/wag/backups/db-....dump` |

## Backups

Nightly at 03:17 into `/opt/wag/backups` (database + uploads, 14 days). A backup on the same server dies with the server, so: (1) turn on Hostinger's VPS **backups/snapshots** in hPanel, and (2) optionally copy off-server: create `/opt/wag/offsite.conf` with one line `REMOTE=user@othermachine:/path` (needs SSH access from the VPS to that machine).

## Aadhaar numbers and photos (read once)

Partners now give their full Aadhaar number and card photos in the partner app. The server keeps the number encrypted in the database and the photos as encrypted files in `/opt/wag/private-uploads` (a folder the web server never shows). The key is `AADHAAR_ENC_KEY` in `/opt/wag/app/apps/api/.env` and `/opt/wag/.secrets`.
- **Copy that key into a password manager today.** If the VPS is lost and the key was not saved, the stored Aadhaar data cannot be recovered.
- Backups contain only the encrypted data, not the key. Keep it that way: never put `.secrets` or `.env` in an off-server backup together with the dumps.
- Only people who log in to the website's panel can click **Show** (every click is recorded in the plugin's Activity log).

## Before real customers (important)

Found while preparing this kit, not caused by the deployment:
- **Payments and KYC are on "mock"** in the template, allowed by `PAYMENT_ALLOW_MOCK` and `KYC_ALLOW_MOCK`. Mock accepts any payment/KYC. Set up Razorpay (`PAYMENT_PROVIDER=razorpay` + keys) and a real KYC provider, then delete those two lines.
- **SMS login codes:** the code has no real SMS sender yet (the OTP service has a `TODO` for Twilio). With `SMS_PROVIDER=mock` the code is returned inside the API answer (so anybody could log in as anybody). With any other value nothing is sent. A real SMS sender needs to be built and the apps' login must stop relying on the returned code before launch. If the old server runs the apps today, ask how login works there before cutting over.
- **The seeded administrator login.** If the database was created with the sample data, an admin account with a known password exists (`admin@wagandtails.in`). With no admin web it is no longer needed for daily work, but the account still exists in the backend. After the first deploy, change its password or set it inactive in the database (`update users set is_active=false where email='admin@wagandtails.in';`) once the website link is working.
- WhatsApp templates (4) must be approved by Meta (docs/deploy-wp-integration.md, section 5).
- Phone-screen testing (docs/qa-checklist-wp-integration.md).

## If a step fails

Copy the **last 30 lines** of the output (never `.env` or `.secrets`) and send them to me; almost every problem is a typo in the domain, DNS not yet pointing at the VPS, or the deploy key not added.
