#!/usr/bin/env bash
# Put a backup back. Run ON THE VPS, as root:   bash /opt/wag/restore.sh /opt/wag/backups/db-YYYYMMDD-HHMMSS.dump
# Also used to MOVE the data of the old server: make a dump there (see README step 7), copy it here, run this.
# It replaces the current API database with the dump. It first saves the current one, just in case.
set -euo pipefail
FILE="${1:-}"
[ -f "$FILE" ] || { echo "Usage: bash restore.sh <dump file>"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }
. /opt/wag/.secrets

echo "Saving the current database first..."
sudo -u wag /opt/wag/backup.sh
systemctl stop wag-api || true
sudo -u postgres psql -c "DROP DATABASE IF EXISTS wagandtails;"
sudo -u postgres createdb -O wag wagandtails
sudo -u postgres psql -d wagandtails -c 'CREATE EXTENSION IF NOT EXISTS postgis;' -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
PGPASSWORD="$DB_PASS" pg_restore -h 127.0.0.1 -U wag -d wagandtails --no-owner --role=wag "$FILE" || true
echo "Applying any newer migrations..."
sudo -u wag bash -c 'cd /opt/wag/app/apps/api && npx prisma migrate deploy'
systemctl start wag-api
echo "Restored. Check:  curl -s http://127.0.0.1:3001/api/v1/health"
