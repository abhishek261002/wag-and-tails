import React, { useEffect, useState, useCallback } from 'react';
import { Badge, bookingStatusVariant } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wagApi.bookings.list({ status: status || undefined, type: type as any || undefined, page, pageSize: 30 }) as any;
      setBookings(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {} finally { setLoading(false); }
  }, [status, type, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-extrabold text-[#1A0A03]">All Bookings</h2><p className="text-sm text-[#9E7B6A]">{total} total</p></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <select className="border border-[#E8D8CC] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
          value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Filter by type">
          <option value="">All types</option>
          <option value="grooming">✂️ Grooming</option>
          <option value="walking">🐾 Walking</option>
        </select>
        <select className="border border-[#E8D8CC] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
          value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          {['', 'needs_partner', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>{['Pet', 'Type', 'Customer', 'Partner', 'Channel', 'Scheduled', 'Status', 'Total'].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap" scope="col">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div></td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-[#9E7B6A]">No bookings</td></tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{b.petName}</div>
                    {b.petCareNotes && <div className="text-xs text-amber-600 truncate max-w-[140px]" title={b.petCareNotes}>📝 {b.petCareNotes}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{b.type === 'grooming' ? `✂️ ${b.packageName ?? ''}` : `🐾 ${b.durationMinutes}min`}</td>
                  <td className="px-4 py-3 text-[#5C3D2E] text-xs">{b.customer?.profile?.firstName} {b.customer?.profile?.lastName}<br/>{b.customer?.phone}</td>
                  <td className="px-4 py-3 text-xs">{b.partner?.user?.profile ? `${b.partner.user.profile.firstName} ${b.partner.user.profile.lastName}` : <span className="text-amber-600">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-xs capitalize text-[#9E7B6A]">{b.channel?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-xs text-[#9E7B6A] whitespace-nowrap">{b.scheduledAt ? format(new Date(b.scheduledAt), 'd MMM, h:mm a') : '—'}</td>
                  <td className="px-4 py-3"><Badge variant={bookingStatusVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-4 py-3 font-bold text-[#4A1E0B]">₹{b.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > 30 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 rounded-xl border border-[#E8D8CC] text-sm font-semibold disabled:opacity-40">← Prev</button>
          <span className="flex items-center text-sm text-[#9E7B6A]">Page {page} of {Math.ceil(total / 30)}</span>
          <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-xl border border-[#E8D8CC] text-sm font-semibold disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
