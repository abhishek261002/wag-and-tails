import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar, Icon, Logo, type NavGroup } from '@wag/ui-web';
import { useAuthStore } from '../store/auth.store';
import { wagApi } from '../lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { name, clearAuth } = useAuthStore();
  const [pendingPartners, setPendingPartners] = useState(0);
  const [payoutsDue, setPayoutsDue] = useState(0);
  const [escalated, setEscalated] = useState(0);

  useEffect(() => {
    wagApi.client.get<any>('/admin/partners?status=pending&pageSize=1').then((r: any) => setPendingPartners(r?.total ?? 0)).catch(() => {});
    wagApi.client.get<any>('/admin/payouts?status=pending&pageSize=1').then((r: any) => setPayoutsDue(r?.total ?? 0)).catch(() => {});
    wagApi.support.listTickets({ escalated: true }).then((t: any) => setEscalated((t ?? []).filter((x: any) => x.status !== 'resolved').length)).catch(() => {});
  }, [pathname]);

  const activeKey = '/' + (pathname.split('/')[1] ?? 'dashboard');

  const groups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { key: '/dashboard', label: 'Dashboard', icon: <Icon name="home" size={17} />, onClick: () => navigate('/dashboard') },
        { key: '/reports', label: 'Reports', icon: <Icon name="doc" size={17} />, onClick: () => navigate('/reports') },
      ],
    },
    {
      label: 'Operations',
      items: [
        { key: '/bookings', label: 'Bookings', icon: <Icon name="cal" size={17} />, onClick: () => navigate('/bookings') },
        { key: '/orders', label: 'Store orders', icon: <Icon name="bag" size={17} />, onClick: () => navigate('/orders') },
        { key: '/payouts', label: 'Payouts', icon: <Icon name="wallet" size={17} />, badge: payoutsDue, onClick: () => navigate('/payouts') },
      ],
    },
    {
      label: 'Catalogue',
      items: [
        { key: '/products', label: 'Products', icon: <Icon name="bag" size={17} />, onClick: () => navigate('/products') },
        { key: '/packages', label: 'Grooming packages', icon: <Icon name="scissors" size={17} />, onClick: () => navigate('/packages') },
        { key: '/coupons', label: 'Offers & coupons', icon: <Icon name="gift" size={17} />, onClick: () => navigate('/coupons') },
      ],
    },
    {
      label: 'People',
      items: [
        { key: '/partners', label: 'Partners', icon: <Icon name="brief" size={17} />, badge: pendingPartners, onClick: () => navigate('/partners') },
        { key: '/customers', label: 'Customers', icon: <Icon name="user" size={17} />, onClick: () => navigate('/customers') },
        { key: '/staff', label: 'Staff', icon: <Icon name="shield" size={17} />, onClick: () => navigate('/staff') },
        { key: '/support', label: 'Escalated support', icon: <Icon name="chat" size={17} />, badge: escalated, onClick: () => navigate('/support') },
      ],
    },
    {
      label: 'Configure',
      items: [
        { key: '/areas', label: 'Service areas', icon: <Icon name="pin" size={17} />, onClick: () => navigate('/areas') },
        { key: '/settings', label: 'Settings', icon: <Icon name="key" size={17} />, onClick: () => navigate('/settings') },
        { key: '/audit-log', label: 'Audit log', icon: <Icon name="doc" size={17} />, onClick: () => navigate('/audit-log') },
      ],
    },
  ];

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#FBF7F2]">
      <Sidebar
        logo={<Logo size={30} ink="#fff" ground="#2B1206" />}
        brandTitle="Wag & Tails"
        brandSubtitle="Admin console"
        groups={groups}
        activeKey={activeKey}
        footer={
          <div className="flex md:flex-col gap-1">
            <button
              className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] hover:bg-white/[0.08] transition-colors text-left shrink-0 whitespace-nowrap"
              onClick={() => navigate('/profile')}
            >
              <span className="w-[26px] h-[26px] rounded-full bg-[#2B1206] shrink-0 grid place-items-center text-[11px] font-bold text-white">
                {(name ?? 'A').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 hidden md:inline">
                <span className="block text-[12.5px] font-semibold text-black group-hover:text-white truncate">{name ?? 'Admin'}</span>
                <span className="block text-[10.5px] text-black/55 group-hover:text-white/55 truncate">Super admin</span>
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-[11px] px-[11px] py-2.5 rounded-[10px] text-black hover:bg-white/[0.08] hover:text-white text-[13.5px] font-medium transition-colors shrink-0 whitespace-nowrap"
            >
              <Icon name="logout" size={17} />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        }
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
