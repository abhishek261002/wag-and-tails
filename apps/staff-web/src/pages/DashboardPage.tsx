import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, KpiCard, Button, Card, CardHeader, CardTitle, Table, TableId, TableStrong, Badge, bookingStatusVariant, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { format } from 'date-fns';

interface Kpis {
  todaysBookings: number;
  unassignedBookings: number;
  needsPartnerBookings: number;
  storeOrdersPlaced: number;
  assignedBookings: number;
  pendingBookings: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { name } = useAuthStore();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [todaysBookings, setTodaysBookings] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      wagApi.client.get<Kpis>('/staff/dashboard'),
      wagApi.bookings.list({ pageSize: 8 }),
      wagApi.bookings.list({ status: 'needs_partner', pageSize: 5 }),
      wagApi.support.listTickets({ status: 'open' }).catch(() => []),
      wagApi.client.get<any>('/staff/partners?status=approved&pageSize=8'),
    ])
      .then(([k, b, u, t, p]) => {
        setKpis(k as Kpis);
        setTodaysBookings((b as any).data ?? []);
        setUnassigned((u as any).data ?? []);
        setTickets((t as any[]).slice(0, 4));
        setPartners((p as any).data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const firstName = (name ?? 'there').split(' ')[0];

  return (
    <div>
      <PageHeader
        title={`Good day, ${firstName}`}
        sub={format(new Date(), 'EEEE, d MMMM yyyy')}
        actions={
          <Button compact leftIcon={<Icon name="plus" size={16} />} onClick={() => navigate('/bookings/new')}>
            New booking
          </Button>
        }
      />

      <div className="p-4 md:p-7 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Today's bookings" value={kpis?.todaysBookings ?? '—'} loading={loading} />
          <KpiCard title="Unassigned" value={kpis?.unassignedBookings ?? '—'} loading={loading} />
          <KpiCard title="Support waiting" value={tickets.length} loading={loading} />
          <KpiCard title="Store orders today" value={kpis?.storeOrdersPlaced ?? '—'} loading={loading} />
        </div>

        {unassigned.length > 0 && (
          <Card className="!border-[#B4520F]">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="text-[#B4520F]"><Icon name="alert" size={19} /></span>
                <CardTitle>Needs a partner assigned</CardTitle>
              </div>
              <Button compact variant="ghost" onClick={() => navigate('/bookings?status=needs_partner')}>View all</Button>
            </CardHeader>
            <Table
              bare
              columns={[
                { key: 'pet', header: 'Booking', render: (b: any) => <TableId>{b.id.slice(0, 8)}</TableId> },
                { key: 'customer', header: 'Customer', render: (b: any) => <TableStrong>{b.customer?.profile ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}` : '—'}</TableStrong> },
                { key: 'svc', header: 'Service', render: (b: any) => (b.type === 'grooming' ? b.packageName ?? 'Grooming' : `${b.durationMinutes}min walk`) },
                { key: 'when', header: 'When', render: (b: any) => (b.scheduledAt ? format(new Date(b.scheduledAt), 'd MMM, h:mm a') : '—') },
                { key: 'action', header: '', align: 'right', render: (b: any) => <Button compact variant="accent" onClick={() => navigate(`/bookings/${b.id}`)}>Assign</Button> },
              ]}
              data={unassigned}
              keyExtractor={(b: any) => b.id}
              onRowClick={(b: any) => navigate(`/bookings/${b.id}`)}
            />
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Today&rsquo;s schedule</CardTitle>
              <Button compact variant="ghost" onClick={() => navigate('/bookings')}>All bookings</Button>
            </CardHeader>
            <Table
              bare
              loading={loading}
              emptyMessage="No bookings yet"
              columns={[
                { key: 'pet', header: 'Booking', render: (b: any) => (
                  <div>
                    <TableId>{b.id.slice(0, 8)}</TableId>
                    <div className="text-[11px] text-[#9A8878] mt-0.5">{b.petName}</div>
                  </div>
                ) },
                { key: 'customer', header: 'Customer', render: (b: any) => (
                  <div>
                    <TableStrong>{b.customer?.profile ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}` : '—'}</TableStrong>
                    <div className="text-[11px] text-[#9A8878] mt-0.5">{b.scheduledAt ? format(new Date(b.scheduledAt), 'd MMM, h:mm a') : '—'}</div>
                  </div>
                ) },
                { key: 'svc', header: 'Service', render: (b: any) => (b.type === 'grooming' ? b.packageName ?? 'Grooming' : `${b.durationMinutes}min walk`) },
                { key: 'partner', header: 'Partner', render: (b: any) => b.partner?.user?.profile ? `${b.partner.user.profile.firstName} ${b.partner.user.profile.lastName}` : <span className="text-[#B3261E] font-semibold">Unassigned</span> },
                { key: 'status', header: 'Status', render: (b: any) => <Badge variant={bookingStatusVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge> },
              ]}
              data={todaysBookings}
              keyExtractor={(b: any) => b.id}
              onRowClick={(b: any) => navigate(`/bookings/${b.id}`)}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support queue</CardTitle>
              <Button compact variant="ghost" onClick={() => navigate('/support')}>Open inbox</Button>
            </CardHeader>
            {tickets.length === 0 ? (
              <div className="text-sm text-[#9A8878] py-6 text-center">No open tickets</div>
            ) : (
              <div className="flex flex-col gap-3">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    className="flex items-center gap-3 text-left w-full hover:bg-[#F9F1E9] rounded-xl p-1.5 -m-1.5 transition-colors"
                    onClick={() => navigate('/support')}
                  >
                    <span className="w-[38px] h-[38px] rounded-full bg-[#F0E2D4] shrink-0 grid place-items-center font-bold text-[#4A1E0B]">
                      {(t.user?.profile?.firstName ?? 'U').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">{t.subject}</span>
                        <span className="text-[11px] text-[#9A8878] shrink-0">{format(new Date(t.createdAt), 'h:mm a')}</span>
                      </span>
                      <span className="block text-xs text-[#9A8878] truncate mt-0.5">{t.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Partners on shift</CardTitle></CardHeader>
          {partners.length === 0 ? (
            <div className="text-sm text-[#9A8878] py-4">No approved partners yet</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {partners.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-[38px] h-[38px] rounded-full shrink-0 grid place-items-center font-bold text-white" style={{ background: (p.modes ?? []).includes('grooming') ? '#F07B2C' : '#1F7A4D' }}>
                    {(p.user?.profile?.firstName ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : '—'}</div>
                    <div className="text-[11px] text-[#9A8878] truncate capitalize">{(p.modes ?? []).join(', ')} &middot; {p.city ?? '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
