import React from 'react';
import clsx from 'clsx';
import { Icon } from './icons.js';

export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  change?: string;
  changePositive?: boolean;
  /** Suffix appended after `change`, matching the prototype's kpiCard(). */
  changeSuffix?: string;
  icon?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  change,
  changePositive,
  changeSuffix = ' vs last month',
  className,
  loading = false,
}: KpiCardProps) {
  return (
    <div className={clsx('bg-white rounded-[14px] border border-[#EDE4D9] p-[18px]', className)}>
      <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#6E5B4B]">{title}</div>
      {loading ? (
        <div className="h-7 w-20 bg-[#F4EDE5] rounded-lg animate-pulse mt-[7px]" />
      ) : (
        <div className="font-extrabold text-[27px] tracking-[-0.8px] leading-none mt-[7px] text-[#1C1006]">
          {value}
        </div>
      )}
      {change && (
        <div
          className={clsx(
            'text-[11.5px] font-semibold mt-1.5 flex items-center gap-1',
            changePositive ? 'text-[#1F7A4D]' : 'text-[#B3261E]'
          )}
        >
          <Icon name={changePositive ? 'chevU' : 'chevD'} size={13} />
          {change}
          {changeSuffix}
        </div>
      )}
    </div>
  );
}
