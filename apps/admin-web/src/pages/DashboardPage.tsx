import React, { useEffect, useState } from 'react';
import { KpiCard } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';
import {
  TrendingUp, ShoppingCart, CalendarCheck,
  XCircle, BarChart2, AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wagApi.client.get<any>('/admin/dashboard')
      .then(setKpis)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n}`;

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-2xl font-extrabold text-[#1A0A03]">Dashboard</h2>
        <p className="text-sm text-[#9E7B6A] mt-0.5">Business overview — this month</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Revenue" value={fmt(kpis?.revenueThisMonth ?? 0)} icon={<TrendingUp size={18} />} loading={loading} changePositive change="This month" />
        <KpiCard title="Bookings" value={kpis?.totalBookings ?? '—'} icon={<CalendarCheck size={18} />} loading={loading} />
        <KpiCard title="Store GMV" value={fmt(kpis?.storeGmv ?? 0)} icon={<ShoppingCart size={18} />} loading={loading} />
        <KpiCard title="Cancel Rate" value={kpis ? `${kpis.cancellationRate}%` : '—'} icon={<XCircle size={18} />} loading={loading} changePositive={false} />
        <KpiCard title="Avg Booking" value={kpis ? fmt(kpis.avgBookingValue) : '—'} icon={<BarChart2 size={18} />} loading={loading} />
        <KpiCard title="Attention" value={kpis?.attentionQueue?.[0]?.count ?? 0} icon={<AlertCircle size={18} />} loading={loading} changePositive={false} change={kpis?.attentionQueue?.[0]?.label} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Channel split */}
        <Section title="📊 Channel Split">
          {kpis?.channelSplit && Object.keys(kpis.channelSplit).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(kpis.channelSplit as Record<string, number>).map(([ch, count]) => {
                const total = Object.values(kpis.channelSplit as Record<string, number>).reduce((s, v) => s + v, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={ch}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold capitalize">{ch.replace(/_/g, ' ')}</span>
                      <span className="text-[#9E7B6A]">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-[#F5EDE3] rounded-full overflow-hidden">
                      <div className="h-full bg-[#F07B2C] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyRow />}
        </Section>

        {/* Top packages */}
        <Section title="✂️ Top Packages">
          {kpis?.topPackages?.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="text-[#9E7B6A]"><th className="text-left py-1">Package</th><th className="text-right py-1">Bookings</th><th className="text-right py-1">Revenue</th></tr></thead>
              <tbody>
                {kpis.topPackages.map((p: any, i: number) => (
                  <tr key={i} className="border-t border-[#F5EDE3]">
                    <td className="py-2 font-semibold">{p.packageName ?? '—'}</td>
                    <td className="py-2 text-right">{p.bookings}</td>
                    <td className="py-2 text-right font-bold text-[#4A1E0B]">{fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyRow />}
        </Section>

        {/* Best sellers */}
        <Section title="🛒 Store Best Sellers">
          {kpis?.bestSellers?.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="text-[#9E7B6A]"><th className="text-left py-1">Product</th><th className="text-right py-1">Sold</th><th className="text-right py-1">Revenue</th></tr></thead>
              <tbody>
                {kpis.bestSellers.map((p: any, i: number) => (
                  <tr key={i} className="border-t border-[#F5EDE3]">
                    <td className="py-2 font-semibold">{p.productName ?? '—'}</td>
                    <td className="py-2 text-right">{p.sold}</td>
                    <td className="py-2 text-right font-bold text-[#4A1E0B]">{fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyRow />}
        </Section>

        {/* Attention queue */}
        <Section title="⚠️ Attention Queue">
          {kpis?.attentionQueue?.length > 0 ? (
            <div className="space-y-2">
              {kpis.attentionQueue.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div>
                    <p className="font-semibold text-sm text-[#1A0A03]">{item.label}</p>
                    <p className="text-xs text-[#9E7B6A] mt-0.5">{item.type}</p>
                  </div>
                  <span className="text-xl font-extrabold text-amber-700">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-[#9E7B6A] text-sm">✅ No items need attention</div>
          )}
        </Section>
      </div>

      {/* Recent bookings */}
      <Section title="📋 Latest Bookings">
        {kpis?.recentBookings?.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-[#9E7B6A]">
              <tr><th className="text-left py-2">Pet</th><th className="text-left py-2">Customer</th><th className="text-left py-2">Service</th><th className="text-right py-2">Total</th><th className="text-right py-2">Date</th></tr>
            </thead>
            <tbody>
              {kpis.recentBookings.map((b: any) => (
                <tr key={b.id} className="border-t border-[#F5EDE3]">
                  <td className="py-2 font-semibold">{b.petName}</td>
                  <td className="py-2 text-[#5C3D2E]">{b.customer?.profile?.firstName} {b.customer?.profile?.lastName}</td>
                  <td className="py-2 capitalize text-[#9E7B6A]">{b.type}</td>
                  <td className="py-2 text-right font-bold text-[#4A1E0B]">₹{b.total}</td>
                  <td className="py-2 text-right text-[#9E7B6A]">{format(new Date(b.createdAt), 'd MMM')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyRow />}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8D8CC] p-5">
      <h3 className="font-bold text-[#1A0A03] mb-4">{title}</h3>
      {children}
    </div>
  );
}
function EmptyRow() {
  return <p className="text-sm text-[#9E7B6A] text-center py-4">No data yet</p>;
}
