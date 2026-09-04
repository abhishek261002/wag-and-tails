import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KpiCard, Button } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { CalendarCheck, AlertCircle, UserCheck, ShoppingBag, Clock, CheckCircle } from 'lucide-react';

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
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      wagApi.client.get<Kpis>('/staff/dashboard'),
      wagApi.bookings.list({ pageSize: 8 }),
    ])
      .then(([k, b]) => {
        setKpis(k as Kpis);
        setRecentBookings((b as any).data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[#1A0A03]">Dashboard</h2>
        <Button onClick={() => navigate('/bookings/new')} leftIcon={<span>+</span>} size="sm">
          New Booking
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Today's Bookings" value={kpis?.todaysBookings ?? '—'} icon={<CalendarCheck size={18} />} loading={loading} />
        <KpiCard title="Unassigned" value={kpis?.unassignedBookings ?? '—'} icon={<AlertCircle size={18} />} loading={loading} changePositive={false} change={kpis?.unassignedBookings ? 'Needs action' : undefined} />
        <KpiCard title="Needs Partner" value={kpis?.needsPartnerBookings ?? '—'} icon={<UserCheck size={18} />} loading={loading} />
        <KpiCard title="Store Orders" value={kpis?.storeOrdersPlaced ?? '—'} icon={<ShoppingBag size={18} />} loading={loading} />
        <KpiCard title="Assigned" value={kpis?.assignedBookings ?? '—'} icon={<CheckCircle size={18} />} loading={loading} />
        <KpiCard title="Pending" value={kpis?.pendingBookings ?? '—'} icon={<Clock size={18} />} loading={loading} />
      </div>

      {/* Attention section */}
      {kpis && kpis.unassignedBookings > 0 && (
        <div className="bg-[#FFF3E0] border border-[#F57C00] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-[#F57C00]" />
            <div>
              <p className="font-bold text-[#1A0A03] text-sm">
                {kpis.unassignedBookings} booking{kpis.unassignedBookings !== 1 ? 's' : ''} need a partner assigned
              </p>
              <p className="text-xs text-[#9E7B6A]">Assign partners to avoid delays</p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/bookings?status=needs_partner')}
            variant="secondary"
            size="sm"
          >
            View
          </Button>
        </div>
      )}

      {/* Recent bookings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#1A0A03]">Recent Bookings</h3>
          <button
            className="text-sm text-[#C25A12] font-semibold hover:underline"
            onClick={() => navigate('/bookings')}
          >
            View all →
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
              <tr>
                {['Pet', 'Type', 'Customer', 'Scheduled', 'Status', 'Total', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#9E7B6A]">No bookings yet</td></tr>
              ) : (
                recentBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2] cursor-pointer transition-colors"
                    onClick={() => navigate(`/bookings/${b.id}`)}
                  >
                    <td className="px-4 py-3 font-semibold">{b.petName}</td>
                    <td className="px-4 py-3 capitalize">{b.type === 'grooming' ? '✂️ Grooming' : '🐾 Walking'}</td>
                    <td className="px-4 py-3 text-[#5C3D2E]">
                      {b.customer?.profile?.firstName} {b.customer?.profile?.lastName}
                    </td>
                    <td className="px-4 py-3 text-[#9E7B6A]">
                      {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-4 py-3 font-bold text-[#4A1E0B]">₹{b.total}</td>
                    <td className="px-4 py-3 text-[#C25A12] font-semibold">→</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    assigned: 'bg-green-100 text-green-700',
    in_progress: 'bg-orange-100 text-orange-700',
    needs_partner: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    pending_payment: 'bg-yellow-100 text-yellow-700',
    partner_on_the_way: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
