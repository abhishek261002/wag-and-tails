import React from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftAddon, rightAddon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#5C3D2E]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <span className="absolute left-3 text-[#9E7B6A] pointer-events-none">
              {leftAddon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full rounded-xl border bg-white px-4 py-2.5 text-[#1A0A03] text-base',
              'placeholder:text-[#9E7B6A]',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-[#F07B2C] focus:border-[#F07B2C]',
              error
                ? 'border-[#C62828] focus:ring-[#C62828]'
                : 'border-[#E8D8CC] hover:border-[#C8AA96]',
              leftAddon && 'pl-10',
              rightAddon && 'pr-10',
              props.disabled && 'opacity-50 cursor-not-allowed bg-[#F5F5F5]',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {rightAddon && (
            <span className="absolute right-3 text-[#9E7B6A]">{rightAddon}</span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[#C62828]" role="alert">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-[#9E7B6A]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
