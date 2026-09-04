import React, { useEffect, useState, useCallback } from 'react';
import { Button, Badge, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { format } from 'date-fns';

export default function PayoutsPage() {
  const { toast } = useToast();
  const { userId } = useAuthStore();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [status, setStatus] = useState('requested');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wagApi.client.get<any>(`/admin/payouts?status=${status}&pageSize=100`) as any;
      setPayouts(res.data ?? []);
      setSelected(new Set());
    } catch {} finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const toggleAll = () => {
    if (selected.size === payouts.length) setSelected(new Set());
    else setSelected(new Set(payouts.map((p) => p.id)));
  };
  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const approveBatch = async () => {
    if (selected.size === 0) { toast({ type: 'error', title: 'Select at least one payout' }); return; }
    setProcessing(true);
    try {
      await wagApi.client.post('/admin/payouts/batch', { payoutIds: [...selected], adminId: userId });
      toast({ type: 'success', title: `Batch approved for ${selected.size} payouts ✅` });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setProcessing(false); }
  };

  const svBadge = (s: string): any => ({
    paid: 'success', approved: 'info', pending: 'default', requested: 'warning',
    processing: 'marigold', failed: 'error',
  }[s] ?? 'default');

  const totalSelected = payouts
    .filter((p) => selected.has(p.id))
    .reduce((s, p) => s + Number(p.netAmount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[#1A0A03]">Payouts</h2>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-white border border-[#E8D8CC] rounded-xl px-4 py-2">
            <span className="text-sm font-semibold">{selected.size} selected · <span className="text-[#4A1E0B] font-bold">₹{totalSelected.toLocaleString('en-IN')}</span></span>
            <Button size="sm" onClick={approveBatch} loading={processing}>Approve Batch</Button>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-white border border-[#E8D8CC] rounded-xl p-1 w-fit">
        {[{ v: 'requested', l: 'Requested' }, { v: 'approved', l: 'Approved' }, { v: 'paid', l: 'Paid' }, { v: 'pending', l: 'Pending' }].map(({ v, l }) => (
          <button key={v} onClick={() => setStatus(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${status === v ? 'bg-[#4A1E0B] text-white' : 'text-[#5C3D2E] hover:bg-[#FBF7F2]'}`}
          >{l}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>
              <th className="px-4 py-3">
                <input type="checkbox" checked={selected.size === payouts.length && payouts.length > 0} onChange={toggleAll}
                  className="w-4 h-4 accent-[#4A1E0B]" aria-label="Select all" />
              </th>
              {['Partner', 'Gross', 'Commission (20%)', 'Net', 'Status', 'Requested', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center"><Spinner /></td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-[#9E7B6A]">No payouts in this state</td></tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id} className={`border-b border-[#F5EDE3] last:border-0 ${selected.has(p.id) ? 'bg-[#FEF3EA]' : 'hover:bg-[#FBF7F2]'}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                      className="w-4 h-4 accent-[#4A1E0B]" aria-label={`Select payout for partner`} />
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {p.partner?.user?.profile ? `${p.partner.user.profile.firstName} ${p.partner.user.profile.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">₹{Number(p.grossAmount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-[#C62828]">-₹{Number(p.commissionAmount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-bold text-[#2E7D32]">₹{Number(p.netAmount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3"><Badge variant={svBadge(p.status)}>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-[#9E7B6A] text-xs">
                    {p.requestedAt ? format(new Date(p.requestedAt), 'd MMM yy') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.status === 'approved' && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        try {
                          await wagApi.client.patch(`/admin/payouts/batches/${p.batchId}/pay`);
                          toast({ type: 'success', title: 'Marked as paid' });
                          load();
                        } catch {}
                      }}>Mark Paid</Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div>;
}
