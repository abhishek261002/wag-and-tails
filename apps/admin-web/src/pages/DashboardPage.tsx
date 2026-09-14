import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, KpiCard, Card, CardHeader, CardTitle, Table, TableStrong, Badge, bookingStatusVariant, Icon, Button, BarChart, Donut } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

const CHANNEL_COLOR: Record<string, string> = { app: '#4A1E0B', whatsapp: '#1F7A4D', phone: '#C25A12' };
const CHANNEL_LABEL: Record<string, string> = { app: 'App', whatsapp: 'WhatsApp', phone: 'Phone' };

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n}`;

export default function DashboardPage() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [pendingPartners, setPendingPartners] = useState(0);
  const [payoutsDue, setPayoutsDue] = useState<{ count: number; amount: number }>({ count: 0, amount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      wagApi.client.get<any>('/admin/dashboard'),
      wagApi.client.get<any>('/admin/reports'),
      wagApi.client.get<any>('/admin/partners?status=pending&pageSize=1'),
      wagApi.client.get<any>('/admin/payouts?status=pending&pageSize=200'),
    ])
      .then(([k, r, p, payouts]) => {
        setKpis(k);
        setReports(r);
        setPendingPartners(p?.total ?? 0);
        const list = payouts?.data ?? [];
        setPayoutsDue({ count: list.length, amount: list.reduce((s: number, x: any) => s + Number(x.netAmount ?? 0), 0) });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const channelItems = reports?.channelSplit?.length
    ? reports.channelSplit.map((c: any) => ({ label: CHANNEL_LABEL[c.channel] ?? c.channel, value: c.pct, color: CHANNEL_COLOR[c.channel] ?? '#B98A62' }))
    : [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        sub={`${format(new Date(), 'MMMM yyyy')} · all channels`}
        actions={<Button compact variant="ghost" leftIcon={<Icon name="cal" size={15} />}>This month</Button>}
      />

      <div className="p-4 md:p-7 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Revenue" value={fmt(kpis?.revenueThisMonth ?? 0)} loading={loading} change="This month" changePositive changeSuffix="" />
          <KpiCard title="Bookings" value={kpis?.totalBookings ?? '—'} loading={loading} />
          <KpiCard title="Store GMV" value={fmt(kpis?.storeGmv ?? 0)} loading={loading} />
          <KpiCard title="Avg booking value" value={kpis ? fmt(kpis.avgBookingValue) : '—'} loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by month</CardTitle>
              <span className="text-xs text-[#6E5B4B]">₹ thousands</span>
            </CardHeader>
            {reports ? (
              <BarChart
                data={reports.monthlyRevenue.map((m: any, i: number) => ({ label: m.label, value: Math.round(m.revenue / 1000), highlight: i === reports.monthlyRevenue.length - 1 }))}
              />
            ) : (
              <div className="h-[180px] animate-pulse bg-[#F4EDE5] rounded-xl" />
            )}
          </Card>
          <Card>
            <CardHeader><CardTitle>Where bookings come from</CardTitle></CardHeader>
            {channelItems.length > 0 ? (
              <Donut items={channelItems} />
            ) : (
              <div className="text-sm text-[#9A8878] py-6 text-center">No bookings yet</div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle>Needs your attention</CardTitle></CardHeader>
            <div className="flex flex-col gap-1">
              <AttentionRow
                tone="warn"
                title="Partner approval pending"
                sub={`${pendingPartners} applicant${pendingPartners === 1 ? '' : 's'}`}
                onClick={() => navigate('/partners')}
              />
              <AttentionRow
                tone="accent"
                title="Payouts to release"
                sub={payoutsDue.count > 0 ? `${payoutsDue.count} pending · ₹${payoutsDue.amount.toLocaleString('en-IN')}` : 'All settled'}
                onClick={() => navigate('/payouts')}
              />
              {kpis?.attentionQueue?.map((item: any, i: number) => (
                <AttentionRow key={i} tone="danger" title={item.label} sub={`${item.count}`} onClick={() => navigate('/bookings?status=needs_partner')} />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top packages</CardTitle></CardHeader>
            {kpis?.topPackages?.length > 0 ? (
              kpis.topPackages.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <span className="text-sm font-bold text-[#9A8878] w-4">{i + 1}</span>
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate">{p.packageName ?? '—'}</span>
                  <span className="text-sm text-[#6E5B4B]">{p.bookings} booked</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-[#9A8878] py-4 text-center">No data yet</div>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>Store bestsellers</CardTitle></CardHeader>
            {kpis?.bestSellers?.length > 0 ? (
              kpis.bestSellers.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <span className="w-[34px] h-[34px] rounded-lg bg-[#F4EDE5] shrink-0" />
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate">{p.productName ?? '—'}</span>
                  <span className="text-sm text-[#6E5B4B]">{p.sold} sold</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-[#9A8878] py-4 text-center">No data yet</div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Latest bookings</CardTitle>
            <Button compact variant="ghost" onClick={() => navigate('/bookings')}>View all</Button>
          </CardHeader>
          <Table
            bare
            loading={loading}
            emptyMessage="No bookings yet"
            columns={[
              { key: 'pet', header: 'Pet', render: (b: any) => <TableStrong>{b.petName}</TableStrong> },
              { key: 'customer', header: 'Customer', render: (b: any) => (b.customer?.profile ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}` : '—') },
              { key: 'svc', header: 'Service', render: (b: any) => (b.type === 'grooming' ? b.packageName ?? 'Grooming' : `${b.durationMinutes}min walk`) },
              { key: 'when', header: 'When', render: (b: any) => format(new Date(b.createdAt), 'd MMM, h:mm a') },
              { key: 'status', header: 'Status', render: (b: any) => <Badge variant={bookingStatusVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge> },
              { key: 'total', header: 'Total', align: 'right', render: (b: any) => <TableStrong>₹{b.total}</TableStrong> },
            ]}
            data={kpis?.recentBookings ?? []}
            keyExtractor={(b: any) => b.id}
            onRowClick={(b: any) => navigate(`/bookings/${b.id}`)}
          />
        </Card>
      </div>
    </div>
  );
}

function AttentionRow({ tone, title, sub, onClick }: { tone: 'warn' | 'accent' | 'danger'; title: string; sub: string; onClick: () => void }) {
  const bg = tone === 'danger' ? 'bg-[#FCECEA] text-[#B3261E]' : 'bg-[#FFF3E9] text-[#A8480C]';
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 text-left py-2 hover:bg-[#F9F1E9] rounded-xl px-1.5 -mx-1.5 transition-colors">
      <span className={`w-[38px] h-[38px] rounded-xl grid place-items-center shrink-0 ${bg}`}>
        <Icon name="alert" size={17} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{title}</span>
        <span className="block text-xs text-[#6E5B4B]">{sub}</span>
      </span>
      <span className="text-[#9A8878] shrink-0"><Icon name="chev" size={15} /></span>
    </button>
  );
}
