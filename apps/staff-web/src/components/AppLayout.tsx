import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar, type NavItem } from '@wag/ui-web';
import { useAuthStore } from '../store/auth.store';
import {
  LayoutDashboard, CalendarCheck, ShoppingBag,
  Users, UserCheck, LogOut, Menu, X,
} from 'lucide-react';

const SIZE = 20;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { name, email, clearAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const activeKey = pathname.split('/')[1] ?? 'dashboard';

  const navItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={SIZE} />, onClick: () => navigate('/dashboard') },
    { key: 'bookings', label: 'Bookings', icon: <CalendarCheck size={SIZE} />, onClick: () => navigate('/bookings') },
    { key: 'orders', label: 'Store Orders', icon: <ShoppingBag size={SIZE} />, onClick: () => navigate('/orders') },
    { key: 'customers', label: 'Customers', icon: <Users size={SIZE} />, onClick: () => navigate('/customers') },
    { key: 'partners', label: 'Partners', icon: <UserCheck size={SIZE} />, onClick: () => navigate('/partners') },
  ];

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        items={navItems}
        activeKey={activeKey}
        collapsed={collapsed}
        footer={
          <div className="flex flex-col gap-2">
            {!collapsed && (
              <div className="px-1 py-2">
                <p className="text-xs font-semibold text-white truncate">{name ?? 'Staff'}</p>
                <p className="text-xs text-[#DCC3A9] truncate">{email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#DCC3A9] hover:bg-white/10 text-sm font-medium transition-colors"
              aria-label="Log out"
            >
              <LogOut size={16} />
              {!collapsed && 'Log out'}
            </button>
          </div>
        }
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-[#E8D8CC] px-6 py-3 flex items-center gap-4 shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-[#9E7B6A] hover:text-[#4A1E0B] transition-colors p-1 rounded-lg"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
          <h1 className="text-base font-semibold text-[#1A0A03]">
            Wag & Tails — <span className="text-[#9E7B6A] font-normal">Staff Portal</span>
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#FBF7F2]">
          {children}
        </main>
      </div>
    </div>
  );
}
