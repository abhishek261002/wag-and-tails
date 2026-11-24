// Not an audit: frees the staging calendar of every booking the audit suites (and the older link tests) made, so the
// next run starts clean.  npx jest -c jest.e2e.config.js test/e2e/cleanup.e2e.ts
import { cleanupAuditBookings, preflight, purgeCancelledAuditBookings, resetWebsiteRateLimits, sql, wp } from './helpers';

it('leaves no audit bookings holding places on the staging calendar', async () => {
  await preflight();
  cleanupAuditBookings();
  purgeCancelledAuditBookings();
  resetWebsiteRateLimits();
  const open = Number(wp(`global $wpdb; echo $wpdb->get_var( "SELECT COUNT(*) FROM " . wt_table() . " WHERE type='booking' AND city='lucknow' AND status IN ('Confirmed','Rescheduled','Pending payment') AND (phone LIKE '91234000%' OR phone='9123400001' OR data LIKE '%\\"source\\":\\"App\\"%')" );`));
  expect(open).toBe(0);
  expect(Number(sql(`select count(*) from bookings where wp_ref is not null and status not in ('completed','cancelled')`))).toBe(0);
});
