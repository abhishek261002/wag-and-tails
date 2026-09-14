import React from 'react';
import clsx from 'clsx';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  onClick: () => void;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface SidebarProps {
  logo?: React.ReactNode;
  brandTitle?: string;
  brandSubtitle?: string;
  /** Grouped nav — matches the prototype's sectioned sidebar. */
  groups?: NavGroup[];
  /** Flat nav — used when no grouping is needed. */
  items?: NavItem[];
  activeKey: string;
  footer?: React.ReactNode;
  collapsed?: boolean;
}

export function Sidebar({
  logo,
  brandTitle = 'Wag & Tails',
  brandSubtitle,
  groups,
  items,
  activeKey,
  footer,
  collapsed = false,
}: SidebarProps) {
  const resolvedGroups: NavGroup[] = groups ?? (items ? [{ label: '', items }] : []);

  return (
    <aside
      className={clsx(
        // Mobile (< md): a horizontal, scrollable top bar.
        // Tablet/desktop (>= md): the usual vertical sidebar.
        'flex bg-[#3A1808] transition-all duration-200 shrink-0 w-full',
        'flex-row items-center gap-1 px-2.5 py-2 overflow-x-auto overflow-y-hidden',
        'md:flex-col md:items-stretch md:gap-0 md:py-5 md:px-3 md:overflow-x-hidden md:overflow-y-auto',
        collapsed ? 'md:w-16' : 'md:w-56 lg:w-60'
      )}
      aria-label="Main navigation"
    >
      <div className={clsx('hidden md:flex items-center gap-2.5 px-2 pb-5', collapsed && 'md:justify-center')}>
        {logo}
        {!collapsed && (
          <div>
            <div className="font-extrabold text-[15px] tracking-tight leading-none text-white">{brandTitle}</div>
            {brandSubtitle && (
              <div className="text-[9.5px] tracking-[0.16em] uppercase text-[#B98A62] mt-0.5">
                {brandSubtitle}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Mobile-only compact mark, so the brand still reads at a glance in the top bar. */}
      <div className="flex md:hidden items-center shrink-0 pl-0.5 pr-1.5">{logo}</div>

      <nav className="flex flex-row md:flex-col flex-1 min-w-0 gap-1 md:gap-0" aria-label="Navigation menu">
        {resolvedGroups.map((group, gi) => (
          <div key={group.label || gi} className="flex flex-row md:flex-col shrink-0 md:shrink items-center md:items-stretch">
            {!collapsed && group.label && (
              <div className="hidden md:block text-[9.5px] font-bold tracking-[0.14em] uppercase text-[rgba(220,195,169,0.42)] px-2.5 pt-4 pb-1.5">
                {group.label}
              </div>
            )}
            <div className="flex flex-row md:flex-col gap-1 md:gap-0.5">
              {group.items.map((item) => {
                const isActive = activeKey === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={item.onClick}
                    className={clsx(
                      'flex items-center gap-[11px] px-[11px] py-2.5 rounded-[10px] text-[13.5px] font-medium transition-colors duration-150 shrink-0 md:shrink md:w-full whitespace-nowrap',
                      isActive
                        ? 'bg-[#E86A1C] text-white font-semibold'
                        : 'text-black hover:bg-white/[0.08] hover:text-white',
                      collapsed && 'md:justify-center'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && <span className="text-left truncate">{item.label}</span>}
                    {!collapsed && item.badge ? (
                      <span
                        className={clsx(
                          'ml-auto rounded-full px-[7px] py-[2px] text-[10.5px] font-bold shrink-0',
                          isActive ? 'bg-black/[0.22] text-white' : 'bg-white/85 text-black'
                        )}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {footer && (
        <div className="flex items-center md:items-stretch shrink-0 pl-2 md:pl-0 md:mt-auto md:pt-4 md:border-t md:border-white/10">
          {footer}
        </div>
      )}
    </aside>
  );
}
