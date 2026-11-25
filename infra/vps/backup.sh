#!/usr/bin/env bash
# Backup of the API database and uploaded files. Runs every night at 03:17 (cron) and before every deploy.
# Run by hand ON THE VPS:  /opt/wag/backup.sh
# Copies stay 14 days in /opt/wag/backups. IMPORTANT: also copy them off this server (see README, "Backups").
set -euo pipefail
. /opt/wag/.secrets
DEST=/opt/wag/backups
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEST"
PGPASSWORD="$DB_PASS" pg_dump -h 127.0.0.1 -U wag -Fc wagandtails > "$DEST/db-$STAMP.dump"
tar -czf "$DEST/uploads-$STAMP.tgz" -C /opt/wag uploads private-uploads
find "$DEST" -name 'db-*.dump' -mtime +14 -delete
find "$DEST" -name 'uploads-*.tgz' -mtime +14 -delete
echo "$(date -Is) backup ok: db-$STAMP.dump"
# Optional off-server copy: if /opt/wag/offsite.conf exists with  REMOTE=user@host:/path  it is rsynced there.
if [ -f /opt/wag/offsite.conf ]; then
  . /opt/wag/offsite.conf
  rsync -a "$DEST/" "$REMOTE/" && echo "$(date -Is) offsite copy ok"
fi
