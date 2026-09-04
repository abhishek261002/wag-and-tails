import type { BadgeVariant } from '@wag/ui-mobile';

export function bookingStatusVariantMobile(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    confirmed: 'success',
    assigned: 'success',
    in_progress: 'marigold',
    partner_on_the_way: 'info',
    arrived: 'info',
    completed: 'success',
    cancelled: 'error',
    refunded: 'warning',
    needs_partner: 'warning',
    pending_payment: 'warning',
    searching_partner: 'warning',
    accepted: 'success',
    expired: 'error',
    draft: 'default',
  };
  return map[status] ?? 'default';
}
