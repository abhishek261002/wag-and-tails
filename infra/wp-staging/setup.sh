#!/usr/bin/env bash
# Installs WordPress, WooCommerce and the wag-and-tails plugin in the staging containers, then loads sample data.
# Run from the repo root: bash infra/wp-staging/setup.sh
set -euo pipefail
# Git Bash on Windows rewrites /paths in arguments; container paths must stay as they are.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
DC="docker compose -f docker-compose.yml"
WP="$DC exec -T cli wp"

$DC up -d
echo "Waiting for WordPress files..."
for i in $(seq 1 60); do $DC exec -T wordpress test -f /var/www/html/wp-config.php && break; sleep 2; done

if ! $WP core is-installed 2>/dev/null; then
  $WP core install --url=http://localhost:8090 --title="Wag & Tails (staging)" --admin_user=admin --admin_password=admin12345 --admin_email=admin@example.test --skip-email
fi
$WP core update >/dev/null  # WooCommerce needs WordPress 7.0+ (the live site runs 7.1)
$WP rewrite structure '/%postname%/' --hard >/dev/null
$WP option update timezone_string Asia/Kolkata >/dev/null
$WP plugin is-installed woocommerce || $WP plugin install woocommerce
$WP plugin activate woocommerce
$WP plugin activate wag-and-tails
$WP eval-file /staging/seed.php
# Store: the products live on wagandtails.in, from the client's product sheet (Status = Live), with images.
docker cp ../../apps/api/scripts/data/store-products.csv "$($DC ps -q cli)":/tmp/store-products.csv 2>/dev/null   && $WP eval-file /staging/import-products.php /tmp/store-products.csv
echo "Staging ready: http://localhost:8090  (admin / admin12345, desk staff: desk.lucknow / desk12345)"
