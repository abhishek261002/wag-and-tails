#!/usr/bin/env bash
# Deploy (first time and every update). Run ON THE VPS:   bash /opt/wag/deploy.sh
# It takes a database backup first, pulls the newest code, builds, migrates the database and restarts the API.
# Run it as root or as the 'wag' user; it switches to 'wag' itself.
set -euo pipefail

# Leave /root first: an SSH login starts there, 'wag' cannot read it, and find/tar in backup.sh then fail.
cd /opt/wag
if [ "$(id -un)" != "wag" ]; then exec sudo -u wag bash "$0" "$@"; fi

REPO="${WAG_REPO:-git@github.com:abhishek261002/wag-and-tails.git}"
BRANCH="${WAG_BRANCH:-main}"
APP=/opt/wag/app

# Before changing anything: a safety copy of the database (skipped on the very first deploy).
if [ -d "$APP/.git" ]; then
  echo "==> Backup before update"
  /opt/wag/backup.sh
fi

echo "==> Getting the code ($BRANCH)"
if [ ! -d "$APP/.git" ]; then
  # .env was already created by setup; keep it while cloning into the folder.
  TMP=$(mktemp -d)
  git clone --branch "$BRANCH" "$REPO" "$TMP/repo"
  cp -an "$APP/." "$TMP/repo/" 2>/dev/null || true   # keep apps/api/.env, never overwrite repo files
  rm -rf "$APP"
  mv "$TMP/repo" "$APP"
  rm -rf "$TMP"
else
  git -C "$APP" fetch origin "$BRANCH"
  git -C "$APP" merge --ff-only "origin/$BRANCH"
fi

cd "$APP"
echo "==> Installing packages (a few minutes)"
npm ci --workspace=@wag/api --include-workspace-root

cd apps/api
echo "==> Database client + migrations"
npx prisma generate
npx prisma migrate deploy

echo "==> Building"
npm run build

echo "==> Restarting the API"
sudo systemctl restart wag-api
sleep 6
if curl -fs http://127.0.0.1:3001/api/v1/health | grep -q '"ok"'; then
  echo "OK: the API is running."
else
  echo "PROBLEM: the API did not answer. Look at the log:  sudo journalctl -u wag-api -n 80 --no-pager"
  exit 1
fi
