import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar, type NavItem } from '@wag/ui-web';
import { useAuthStore } from '../store/auth.store';
import {
  LayoutDashboard, CalendarCheck, Users, UserCheck,
  Wallet, Tag, Scissors, Package, ShoppingBag,
  Shield, ScrollText, LogOut, Menu, X,
} from 'lucide-react';

const S = 18;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { name, email, clearAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const activeKey = pathname.split('/')[1] ?? 'dashboard';

  const navItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={S} />, onClick: () => navigate('/dashboard') },
    { key: 'bookings', label: 'Bookings', icon: <CalendarCheck size={S} />, onClick: () => navigate('/bookings') },
    { key: 'customers', label: 'Customers', icon: <Users size={S} />, onClick: () => navigate('/customers') },
    { key: 'partners', label: 'Partners', icon: <UserCheck size={S} />, onClick: () => navigate('/partners') },
    { key: 'payouts', label: 'Payouts', icon: <Wallet size={S} />, onClick: () => navigate('/payouts') },
    { key: 'coupons', label: 'Coupons', icon: <Tag size={S} />, onClick: () => navigate('/coupons') },
    { key: 'packages', label: 'Packages', icon: <Scissors size={S} />, onClick: () => navigate('/packages') },
    { key: 'products', label: 'Products', icon: <Package size={S} />, onClick: () => navigate('/products') },
    { key: 'staff', label: 'Staff Users', icon: <Shield size={S} />, onClick: () => navigate('/staff') },
    { key: 'audit-log', label: 'Audit Log', icon: <ScrollText size={S} />, onClick: () => navigate('/audit-log') },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        items={navItems}
        activeKey={activeKey}
        collapsed={collapsed}
        footer={
          <div className="flex flex-col gap-2">
            {!collapsed && (
              <div className="px-1 py-2">
                <p className="text-xs font-semibold text-white truncate">{name ?? 'Admin'}</p>
                <p className="text-xs text-[#DCC3A9] truncate">{email}</p>
              </div>
            )}
            <button
              onClick={() => { clearAuth(); navigate('/login'); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#DCC3A9] hover:bg-white/10 text-sm font-medium transition-colors"
              aria-label="Log out"
            >
              <LogOut size={14} />
              {!collapsed && 'Log out'}
            </button>
          </div>
        }
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-[#E8D8CC] px-6 py-3 flex items-center gap-4 shrink-0">
          <button onClick={() => setCollapsed((c) => !c)} className="text-[#9E7B6A] hover:text-[#4A1E0B] p-1 rounded-lg" aria-label="Toggle sidebar">
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
          <span className="text-base font-semibold text-[#1A0A03]">
            Wag & Tails — <span className="text-[#9E7B6A] font-normal">Super Admin</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-[#FEF3EA] text-[#C25A12] text-xs font-bold px-3 py-1 rounded-full">
              🔑 Admin
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-[#FBF7F2]">
          {children}
        </main>
      </div>
    </div>
  );
}
