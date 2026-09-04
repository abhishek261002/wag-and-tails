import React from 'react';
import clsx from 'clsx';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  onClick: () => void;
}

export interface SidebarProps {
  logo?: React.ReactNode;
  items: NavItem[];
  activeKey: string;
  footer?: React.ReactNode;
  collapsed?: boolean;
}

export function Sidebar({ logo, items, activeKey, footer, collapsed = false }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-[#4A1E0B] text-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-5 border-b border-[rgba(255,255,255,0.1)]',
          collapsed && 'justify-center'
        )}
      >
        {logo ?? (
          <span className="text-2xl font-extrabold text-[#F07B2C]">
            {collapsed ? 'W' : 'Wag & Tails'}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto" aria-label="Navigation menu">
        <ul role="list" className="flex flex-col gap-1 px-2">
          {items.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <li key={item.key}>
                <button
                  onClick={item.onClick}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-[#F07B2C] text-white'
                      : 'text-[#DCC3A9] hover:bg-[rgba(255,255,255,0.1)] hover:text-white',
                    collapsed && 'justify-center'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                  {!collapsed && item.badge ? (
                    <span className="ml-auto bg-[#F07B2C] text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {footer && (
        <div className="px-2 py-4 border-t border-[rgba(255,255,255,0.1)]">{footer}</div>
      )}
    </aside>
  );
}
