import React from 'react';
import clsx from 'clsx';

// Tones ported verbatim from the prototype's .pill--* classes.
export type BadgeVariant =
  | 'accent'
  | 'solid'
  | 'brand'
  | 'brand-solid'
  | 'ok'
  | 'warn'
  | 'danger'
  | 'info'
  | 'muted'
  | 'outline'
  // legacy aliases kept so existing call sites keep compiling
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'marigold';

const ALIAS: Partial<Record<BadgeVariant, BadgeVariant>> = {
  default: 'muted',
  success: 'ok',
  warning: 'warn',
  error: 'danger',
  marigold: 'accent',
};

const variants: Record<string, string> = {
  accent: 'bg-[#FFF3E9] text-[#A8480C]',
  solid: 'bg-[#E86A1C] text-white',
  brand: 'bg-[#F9F1E9] text-[#4A1E0B]',
  'brand-solid': 'bg-[#4A1E0B] text-white',
  ok: 'bg-[#E7F4ED] text-[#1F7A4D]',
  warn: 'bg-[#FFF1E4] text-[#B4520F]',
  danger: 'bg-[#FCECEA] text-[#B3261E]',
  info: 'bg-[#E9F2F8] text-[#1F5F8B]',
  muted: 'bg-[#F4EDE5] text-[#6E5B4B]',
  outline: 'bg-transparent border border-[#E2D5C6] text-[#6E5B4B]',
};

export function Badge({
  variant = 'muted',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  const tone = ALIAS[variant] ?? variant;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-[11px] py-[6px] rounded-full text-[11.5px] font-semibold whitespace-nowrap',
        variants[tone] ?? variants.muted,
        className
      )}
    >
      {children}
    </span>
  );
}

// Maps a booking/order/partner/document status string to the prototype's
// statusDot() tone table (js/screens-staff.js).
const STATUS_TONE: Record<string, BadgeVariant> = {
  'On the way': 'solid',
  'In progress': 'solid',
  'Confirmed': 'accent',
  'Completed': 'ok',
  'Delivered': 'ok',
  'Cancelled': 'muted',
  'Needs partner': 'danger',
  'Packed': 'info',
  'Out for delivery': 'accent',
  'Active': 'ok',
  'Pending': 'warn',
  'New': 'danger',
  'Booked': 'ok',
  'Needs follow-up': 'warn',
  'Verified': 'ok',
  'Renewal due': 'warn',
  'Under review': 'info',
  'Paid': 'ok',
  'Due': 'warn',
};

export function statusTone(status: string): BadgeVariant {
  return STATUS_TONE[status] ?? 'muted';
}

// Booking-status enum (API) → prototype tone, for existing call sites.
export function bookingStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    confirmed: 'accent',
    assigned: 'ok',
    in_progress: 'solid',
    partner_on_the_way: 'solid',
    arrived: 'info',
    completed: 'ok',
    cancelled: 'muted',
    refunded: 'warn',
    needs_partner: 'danger',
    pending_payment: 'warn',
    searching_partner: 'warn',
    accepted: 'ok',
    expired: 'danger',
    draft: 'muted',
  };
  return map[status] ?? 'muted';
}
