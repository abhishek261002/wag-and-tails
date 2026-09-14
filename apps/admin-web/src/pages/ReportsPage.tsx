import React, { useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardTitle, KpiCard, BarChart, Donut, Table, TableStrong, Button, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';

const CHANNEL_COLOR: Record<string, string> = {
  app: '#4A1E0B',
  whatsapp: '#1F7A4D',
  phone: '#C25A12',
};
const CHANNEL_LABEL: Record<string, string> = {
  app: 'App',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
};

interface Reports {
  monthlyRevenue: { month: string; label: string; revenue: number }[];
  revenueByLine: { line: string; revenue: number; share: number }[];
  channelSplit: { channel: string; count: number; pct: number }[];
  kpis: { grossRevenue: number; avgBookingValue: number; repeatRate: number; partnerUtilization: number };
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function ReportsPage() {
  const [data, setData] = useState<Reports | null>(null);

  useEffect(() => {
    wagApi.client.get<Reports>('/admin/reports').then(setData).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="Reports"
        sub="Last 6 months"
        actions={
          <Button compact variant="ghost" leftIcon={<Icon name="doc" size={15} />} onClick={() => window.print()}>
            Export
          </Button>
        }
      />
      <div className="p-4 md:p-7">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Gross revenue" value={data ? fmt(data.kpis.grossRevenue) : '—'} />
          <KpiCard title="Avg booking value" value={data ? fmt(data.kpis.avgBookingValue) : '—'} />
          <KpiCard title="Repeat rate" value={data ? `${data.kpis.repeatRate}%` : '—'} />
          <KpiCard title="Partner utilisation" value={data ? `${data.kpis.partnerUtilization}%` : '—'} />
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Monthly revenue</CardTitle>
            <span className="text-xs text-[#6E5B4B]">₹</span>
          </CardHeader>
          {data ? (
            <BarChart
              data={data.monthlyRevenue.map((m, i) => ({
                label: m.label,
                value: m.revenue,
                highlight: i === data.monthlyRevenue.length - 1,
              }))}
              valueLabel={(v) => `₹${Math.round(v / 1000)}k`}
            />
          ) : (
            <div className="h-[180px] animate-pulse bg-[#F4EDE5] rounded-xl" />
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Revenue by line</CardTitle></CardHeader>
            {data && (
              <Table
                bare
                columns={[
                  { key: 'line', header: 'Line', render: (r) => <TableStrong>{r.line}</TableStrong> },
                  { key: 'revenue', header: 'Revenue', render: (r) => fmt(r.revenue) },
                  { key: 'share', header: 'Share', render: (r) => `${r.share}%` },
                ]}
                data={data.revenueByLine}
                keyExtractor={(r) => r.line}
              />
            )}
          </Card>
          <Card>
            <CardHeader><CardTitle>Bookings by channel</CardTitle></CardHeader>
            {data && data.channelSplit.length > 0 ? (
              <Donut
                items={data.channelSplit.map((c) => ({
                  label: CHANNEL_LABEL[c.channel] ?? c.channel,
                  value: c.pct,
                  color: CHANNEL_COLOR[c.channel] ?? '#B98A62',
                }))}
                centerValue={data.channelSplit.reduce((s, c) => s + c.count, 0)}
                centerLabel="bookings"
              />
            ) : (
              <div className="text-sm text-[#9A8878]">No bookings in this window yet.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
