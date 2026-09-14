import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar, Icon, Logo, type NavGroup } from '@wag/ui-web';
import { useAuthStore } from '../store/auth.store';
import { wagApi } from '../lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { name, clearAuth } = useAuthStore();
  const [unassigned, setUnassigned] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    wagApi.client.get<any>('/staff/dashboard').then((k: any) => setUnassigned(k?.unassignedBookings ?? 0)).catch(() => {});
    wagApi.support.listTickets({ status: 'open' }).then((t: any) => setOpenTickets(Array.isArray(t) ? t.length : 0)).catch(() => {});
  }, [pathname]);

  const activeKey = '/' + (pathname.split('/')[1] ?? 'dashboard');

  const groups: NavGroup[] = [
    {
      label: 'Operations',
      items: [
        { key: '/dashboard', label: 'Dashboard', icon: <Icon name="home" size={17} />, onClick: () => navigate('/dashboard') },
        { key: '/bookings', label: 'Bookings', icon: <Icon name="cal" size={17} />, badge: unassigned, onClick: () => navigate('/bookings') },
        { key: '/orders', label: 'Store orders', icon: <Icon name="bag" size={17} />, onClick: () => navigate('/orders') },
        { key: '/support', label: 'Support', icon: <Icon name="chat" size={17} />, badge: openTickets, onClick: () => navigate('/support') },
      ],
    },
    {
      label: 'Directory',
      items: [
        { key: '/customers', label: 'Customers', icon: <Icon name="user" size={17} />, onClick: () => navigate('/customers') },
        { key: '/partners', label: 'Partners', icon: <Icon name="brief" size={17} />, onClick: () => navigate('/partners') },
      ],
    },
  ];

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#FBF7F2]">
      <Sidebar
        logo={<Logo size={30} ink="#fff" ground="#3A1808" />}
        brandTitle="Wag & Tails"
        brandSubtitle="Staff portal"
        groups={groups}
        activeKey={activeKey}
        footer={
          <div className="flex md:flex-col gap-1">
            <button
              className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] hover:bg-white/[0.08] transition-colors text-left shrink-0 whitespace-nowrap"
              onClick={() => navigate('/profile')}
            >
              <span className="w-[26px] h-[26px] rounded-full bg-[#F07B2C] shrink-0 grid place-items-center text-[11px] font-bold text-white">
                {(name ?? 'S').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 hidden md:inline">
                <span className="block text-[12.5px] font-semibold text-white truncate">{name ?? 'Staff'}</span>
                <span className="block text-[10.5px] text-white/55 truncate">Bookings staff</span>
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-[11px] px-[11px] py-2.5 rounded-[10px] text-white/[0.72] hover:bg-white/[0.08] hover:text-white text-[13.5px] font-medium transition-colors shrink-0 whitespace-nowrap"
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
