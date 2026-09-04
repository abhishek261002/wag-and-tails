import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[#FBF7F2] flex items-center justify-center text-[#9E7B6A] mb-4">
          {icon}
        </div>
      )}
      <p className="text-lg font-semibold text-[#1A0A03] mb-1">{title}</p>
      {description && <p className="text-sm text-[#9E7B6A] max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}
