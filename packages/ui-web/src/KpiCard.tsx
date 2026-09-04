import React from 'react';
import clsx from 'clsx';

export interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  changePositive?: boolean;
  icon?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  change,
  changePositive,
  icon,
  className,
  loading = false,
}: KpiCardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-[#E8D8CC] p-5 shadow-sm flex flex-col gap-2',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[#5C3D2E]">{title}</p>
        {icon && (
          <span className="w-9 h-9 rounded-xl bg-[#FBF7F2] flex items-center justify-center text-[#4A1E0B]">
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-[#F5EDE3] rounded-lg animate-pulse" />
      ) : (
        <p className="text-2xl font-extrabold text-[#1A0A03] leading-none">{value}</p>
      )}
      {change && (
        <p
          className={clsx(
            'text-xs font-medium',
            changePositive ? 'text-[#2E7D32]' : 'text-[#C62828]'
          )}
        >
          {changePositive ? '↑' : '↓'} {change}
        </p>
      )}
    </div>
  );
}
