import React from 'react';
import clsx from 'clsx';
import { Icon, IconFill } from './icons.js';

// Matches the prototype's `.topbar` (webPage() shell header).
export function PageHeader({
  title,
  sub,
  actions,
  search = false,
  onSearchChange,
  searchPlaceholder = 'Search…',
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  search?: boolean;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 md:gap-4 px-4 md:px-7 py-3.5 md:py-4 bg-white border-b border-[#EDE4D9]">
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-[17px] md:text-[20px] tracking-[-0.4px] text-[#1C1006] truncate" style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
          {title}
        </div>
        {sub && <div className="text-xs text-[#6E5B4B] mt-0.5 truncate">{sub}</div>}
      </div>
      {search && (
        <label className="order-3 md:order-none w-full md:w-[280px] shrink-0 bg-[#F4EDE5] rounded-[10px] px-[13px] py-[9px] flex items-center gap-[9px] text-[13px] text-[#9A8878]">
          <Icon name="search" size={15} />
          <input
            className="bg-transparent outline-none w-full placeholder:text-[#9A8878] text-[#1C1006]"
            placeholder={searchPlaceholder}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </label>
      )}
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">{actions}</div>}
    </div>
  );
}

// Matches `.filterchip`.
export function FilterChip({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={clsx(
        'px-[14px] py-[9px] rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors',
        active ? 'bg-[#4A1E0B] border border-[#4A1E0B] text-white' : 'bg-white border border-[#E2D5C6] text-[#4A3A2C] hover:bg-[#F4EDE5]'
      )}
    >
      {children}
    </button>
  );
}

// Matches `.toolbar`.
export function Toolbar({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('flex items-center gap-2.5 flex-wrap mb-4', className)}>{children}</div>;
}

const BANNER_TONE: Record<string, { bg: string; border?: string; icon: string }> = {
  accent: { bg: 'bg-[#FFF3E9]', border: 'border border-[#FCE3CE]', icon: 'text-[#C25A12]' },
  ok: { bg: 'bg-[#E7F4ED]', icon: 'text-[#1F7A4D]' },
  warn: { bg: 'bg-[#FFF1E4]', icon: 'text-[#B4520F]' },
  info: { bg: 'bg-[#E9F2F8]', icon: 'text-[#1F5F8B]' },
};

// Matches `.banner`.
export function Banner({
  tone = 'info',
  icon = 'info',
  title,
  body,
  action,
}: {
  tone?: 'accent' | 'ok' | 'warn' | 'info';
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const t = BANNER_TONE[tone];
  return (
    <div className={clsx('flex items-start gap-3 rounded-[18px] p-3.5', t.bg, t.border)}>
      <span className={clsx('shrink-0 mt-px', t.icon)}>
        <Icon name={icon} size={19} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#1C1006]">{title}</div>
        {body && <div className="text-xs text-[#6E5B4B] mt-1">{body}</div>}
      </div>
      {action}
    </div>
  );
}

// Matches `kv()` — a label/value row used inside detail cards.
export function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[13px] text-[#6E5B4B]">{k}</span>
      <span className="text-[13px] font-semibold text-[#1C1006] text-right">{v}</span>
    </div>
  );
}

// Matches `.tile` — a selectable row used for pickers (partner/package/slot lists).
export function Tile({
  selected,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      {...props}
      className={clsx(
        'w-full text-left bg-white border rounded-[18px] p-3.5 flex items-center gap-3 transition-colors',
        selected ? 'border-[#4A1E0B] shadow-[0_0_0_3px_rgba(74,30,11,0.08)]' : 'border-[#EDE4D9] hover:bg-[#F9F1E9]',
        className
      )}
    >
      {children}
    </button>
  );
}

// Matches `ratingChip()`.
export function RatingChip({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#1C1006]">
      <IconFill name="star" size={13} className="text-[#F07B2C]" />
      {value}
    </span>
  );
}

// Matches `.divider`.
export function Divider({ className }: { className?: string }) {
  return <div className={clsx('h-px bg-[#EDE4D9]', className)} />;
}
