import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Badge, bookingStatusVariant, EmptyState } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';
import { Plus, RefreshCw, Search } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'needs_partner', label: 'Needs Partner' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function BookingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wagApi.bookings.list({
        status: status || undefined,
        type: type as any || undefined,
        page,
        pageSize: 25,
      }) as any;
      setBookings(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {}
    finally { setLoading(false); }
  }, [status, type, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A0A03]">Bookings</h2>
          <p className="text-sm text-[#9E7B6A] mt-0.5">{total} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} leftIcon={<RefreshCw size={14} />}>Refresh</Button>
          <Button size="sm" onClick={() => navigate('/bookings/new')} leftIcon={<Plus size={14} />}>New Booking</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Type */}
        <div className="flex gap-1 bg-white border border-[#E8D8CC] rounded-xl p-1">
          {[{ v: '', l: 'All' }, { v: 'grooming', l: '✂️ Grooming' }, { v: 'walking', l: '🐾 Walking' }].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setFilter('type', v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${type === v ? 'bg-[#4A1E0B] text-white' : 'text-[#5C3D2E] hover:bg-[#FBF7F2]'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Status */}
        <select
          className="border border-[#E8D8CC] rounded-xl px-3 py-2 text-sm text-[#1A0A03] bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
          value={status}
          onChange={(e) => setFilter('status', e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>
              {['Pet', 'Type', 'Customer', 'Partner', 'Scheduled', 'Status', 'Total', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div></td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-[#9E7B6A]">No bookings found</td></tr>
            ) : (
              bookings.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2] cursor-pointer transition-colors"
                  onClick={() => navigate(`/bookings/${b.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold">{b.petName}</div>
                    <div className="text-xs text-[#9E7B6A]">{b.petBreed}</div>
                    {b.petCareNotes && <div className="text-xs text-orange-600 mt-0.5 max-w-[160px] truncate">📝 {b.petCareNotes}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {b.type === 'grooming' ? '✂️ ' + (b.packageName ?? 'Grooming') : `🐾 ${b.durationMinutes}min walk`}
                  </td>
                  <td className="px-4 py-3 text-[#5C3D2E]">
                    {b.customer?.profile ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}` : '—'}
                    <div className="text-xs text-[#9E7B6A]">{b.customer?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-[#5C3D2E]">
                    {b.partner?.user?.profile
                      ? `${b.partner.user.profile.firstName} ${b.partner.user.profile.lastName}`
                      : <span className="text-[#F57C00] font-semibold">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-[#9E7B6A] whitespace-nowrap">
                    {b.scheduledAt ? format(new Date(b.scheduledAt), 'd MMM, h:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={bookingStatusVariant(b.status)}>
                      {b.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#4A1E0B]">₹{b.total}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/bookings/${b.id}`)}
                      className="text-xs font-semibold text-[#C25A12] hover:underline"
                    >
                      Manage →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
          <span className="flex items-center text-sm text-[#9E7B6A]">Page {page} of {Math.ceil(total / 25)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((p) => p + 1)}>Next →</Button>
        </div>
      )}
    </div>
  );
}
