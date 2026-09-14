import React from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  /** Dense console-action style (the prototype's `.wbtn`) — used for table/toolbar actions. */
  compact?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#4A1E0B] text-white hover:bg-[#3A1808] active:bg-[#2B1206] shadow-sm',
  secondary: 'bg-[#F07B2C] text-white hover:bg-[#C25A12] active:bg-[#A8480C]',
  accent: 'bg-[#E86A1C] text-white hover:bg-[#C25A12] active:bg-[#A8480C]',
  outline: 'border border-[#E2D5C6] text-[#1C1006] bg-white hover:bg-[#F4EDE5]',
  ghost: 'bg-white border border-[#E2D5C6] text-[#1C1006] hover:bg-[#F4EDE5]',
  danger: 'bg-[#FCECEA] text-[#B3261E] hover:bg-[#FBE0DD]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-base rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-lg rounded-xl gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      compact = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={clsx(
          'inline-flex items-center justify-center font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F07B2C] focus-visible:ring-offset-2 select-none whitespace-nowrap',
          variantStyles[variant],
          compact ? 'px-[14px] py-[9px] text-[13px] rounded-[9px] gap-[7px]' : sizeStyles[size],
          fullWidth && 'w-full',
          isDisabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <Spinner size={size} />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

function Spinner({ size }: { size: ButtonSize }) {
  const s = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
