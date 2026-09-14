import React from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const paddingMap = {
  none: '',
  sm: 'p-3.5',
  md: 'p-[18px]',
  lg: 'p-6',
};

// Matches the prototype's `.wcard`.
export function Card({ padding = 'md', interactive = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-[14px] border border-[#EDE4D9]',
        paddingMap[padding],
        interactive && 'cursor-pointer hover:border-[#DCC3A9] transition-colors duration-150',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Matches `.wcard__head` — title on the left, an action/trailing node on the right.
export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('flex items-center justify-between gap-3 mb-3.5', className)} {...props}>
      {children}
    </div>
  );
}

// Matches `.wcard__t`.
export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx('font-bold text-[15px] tracking-[-0.2px] text-[#1C1006]', className)}
      style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}
      {...props}
    >
      {children}
    </h3>
  );
}
