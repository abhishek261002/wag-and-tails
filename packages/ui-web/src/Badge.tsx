import React from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'marigold';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[#EDD9C4] text-[#4A1E0B]',
  success: 'bg-[#E8F5E9] text-[#2E7D32]',
  warning: 'bg-[#FFF3E0] text-[#F57C00]',
  error: 'bg-[#FFEBEE] text-[#C62828]',
  info: 'bg-[#E3F2FD] text-[#1565C0]',
  marigold: 'bg-[#FEF3EA] text-[#C25A12]',
};

export function Badge({
  variant = 'default',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Map booking status → badge variant
export function bookingStatusVariant(status: string): BadgeVariant {
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
