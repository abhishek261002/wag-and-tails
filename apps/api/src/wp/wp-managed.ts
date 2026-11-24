import { ConflictException } from '@nestjs/common';

/** True while the WordPress plugin owns the price list (cities, package prices, coupons, walk prices). */
export function wpPriceListOn(): boolean {
  return !!(process.env['WP_CONNECTOR_URL'] && process.env['WP_CONNECTOR_SECRET']);
}

/** Thrown when someone edits in our panel what the next sync from the website would overwrite. */
export function managedByWebsite(what: string): ConflictException {
  return new ConflictException({
    code: 'MANAGED_BY_WEBSITE',
    message: `${what} are managed in the website's WordPress admin panel. Change them there; the apps pick up the change within 5 minutes.`,
  });
}
