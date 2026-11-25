#!/usr/bin/env bash
# ONE-TIME server setup for the Wag & Tails API on a fresh Ubuntu 22.04 / 24.04 VPS.
# Run this ON THE VPS, as root:   bash setup-server.sh api.yourdomain.in
# Safe to run again: it skips what already exists and never touches an existing database or .env.
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: bash setup-server.sh <api-domain>      e.g.  bash setup-server.sh api.wagandtails.in"
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then echo "Run as root (you are logged in as root on a new Hostinger VPS)."; exit 1; fi

APP_USER=wag
BASE=/opt/wag
APP_DIR=$BASE/app
DB_NAME=wagandtails
DB_USER=wag

echo "==> 1/9 System update"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ufw fail2ban ca-certificates gnupg build-essential openssl unattended-upgrades rsync

echo "==> 2/9 Swap file (safety net so builds do not run out of memory)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 3/9 Firewall: only SSH, HTTP, HTTPS are open. Database and Redis stay closed."
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

echo "==> 4/9 Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 5/9 PostgreSQL + PostGIS + Redis"
apt-get install -y postgresql postgresql-contrib postgis redis-server
PGV=$(ls /usr/lib/postgresql | sort -V | tail -1)
apt-get install -y "postgresql-$PGV-postgis-3" || true
systemctl enable --now postgresql redis-server
# Redis: only this machine, never the internet.
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
sed -i 's/^protected-mode .*/protected-mode yes/' /etc/redis/redis.conf
systemctl restart redis-server

echo "==> 6/9 App user and folders"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
mkdir -p "$BASE" "$BASE/backups" "$BASE/uploads" "$BASE/private-uploads"
chmod 700 "$BASE/private-uploads"
chown -R "$APP_USER:$APP_USER" "$BASE"

echo "==> 7/9 Database"
SECRETS=$BASE/.secrets
if [ ! -f "$SECRETS" ]; then
  DB_PASS=$(openssl rand -hex 24)
  JWT_SECRET=$(openssl rand -hex 48)
  JWT_REFRESH_SECRET=$(openssl rand -hex 48)
  PEPPER=$(openssl rand -hex 32)
  AADHAAR_ENC_KEY=$(openssl rand -hex 32)
  cat > "$SECRETS" <<EOF
DB_PASS=$DB_PASS
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
AADHAAR_HASH_PEPPER=$PEPPER
AADHAAR_ENC_KEY=$AADHAAR_ENC_KEY
EOF
  chmod 600 "$SECRETS"
fi
# shellcheck disable=SC1090
. "$SECRETS"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
sudo -u postgres psql -d "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS postgis;' -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

echo "==> 8/9 Environment file (only created if missing)"
mkdir -p "$APP_DIR/apps/api"
ENV_FILE=$APP_DIR/apps/api/.env
if [ ! -f "$ENV_FILE" ]; then
  sed -e "s|__DOMAIN__|$DOMAIN|g" \
      -e "s|__DB_PASS__|$DB_PASS|g" \
      -e "s|__JWT_SECRET__|$JWT_SECRET|g" \
      -e "s|__JWT_REFRESH_SECRET__|$JWT_REFRESH_SECRET|g" \
      -e "s|__PEPPER__|$AADHAAR_HASH_PEPPER|g" \
      -e "s|__AADHAAR_KEY__|$AADHAAR_ENC_KEY|g" \
      "$(dirname "$(readlink -f "$0")")/env.production.template" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE  (open it later to add the Razorpay / Twilio / FCM keys)"
fi
chown -R "$APP_USER:$APP_USER" "$BASE"

echo "==> 9/9 Web server (Caddy: automatic HTTPS), API service, daily backup"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode gzip
	request_body {
		max_size 25MB
	}
	reverse_proxy 127.0.0.1:3001
}
EOF
systemctl enable caddy
systemctl restart caddy

cat > /etc/systemd/system/wag-api.service <<EOF
[Unit]
Description=Wag and Tails API
After=network.target postgresql.service redis-server.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR/apps/api
ExecStart=/usr/bin/node dist/apps/api/src/main.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable wag-api

# Copy the helper scripts next to the app so you can run them by short names.
SRC="$(dirname "$(readlink -f "$0")")"
for f in deploy.sh backup.sh restore.sh; do cp "$SRC/$f" "$BASE/$f"; chmod +x "$BASE/$f"; done
chown "$APP_USER:$APP_USER" "$BASE"/*.sh
echo "$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart wag-api, /usr/bin/systemctl start wag-api, /usr/bin/systemctl stop wag-api" > /etc/sudoers.d/wag-api
chmod 440 /etc/sudoers.d/wag-api
echo '17 3 * * * /opt/wag/backup.sh >> /opt/wag/backups/backup.log 2>&1' > /tmp/wagcron
crontab -u "$APP_USER" /tmp/wagcron && rm /tmp/wagcron

# Deploy key: lets the server READ (never write) the private GitHub repository.
KEY=/home/$APP_USER/.ssh/id_ed25519
if [ ! -f "$KEY" ]; then
  sudo -u "$APP_USER" mkdir -p "/home/$APP_USER/.ssh"
  sudo -u "$APP_USER" ssh-keygen -t ed25519 -N "" -f "$KEY" -C "wag-vps-deploy"
  sudo -u "$APP_USER" bash -c "ssh-keyscan github.com >> /home/$APP_USER/.ssh/known_hosts 2>/dev/null"
fi

echo
echo "=================================================================="
echo " Server is ready. Next:"
echo " 1. Copy the key below into GitHub -> your repo -> Settings ->"
echo "    Deploy keys -> Add deploy key (leave 'Allow write access' OFF)."
echo
cat "$KEY.pub"
echo
echo " 2. Then run:   bash /opt/wag/deploy.sh"
echo "=================================================================="
