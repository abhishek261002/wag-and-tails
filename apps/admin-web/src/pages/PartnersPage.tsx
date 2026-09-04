import React, { useEffect, useState, useCallback } from 'react';
import { Button, Badge, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';
import { useAuthStore } from '../store/auth.store';

export default function PartnersPage() {
  const { toast } = useToast();
  const { userId } = useAuthStore();
  const [partners, setPartners] = useState<any[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wagApi.client.get<any>(`/admin/partners?status=${status}&pageSize=50`) as any;
      setPartners(res.data ?? []);
    } catch {} finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (partnerId: string) => {
    try {
      await wagApi.client.patch(`/admin/partners/${partnerId}/approve`, { adminId: userId });
      toast({ type: 'success', title: 'Partner approved ✅' });
      load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
  };

  const handleSuspend = async (partnerId: string) => {
    const reason = window.prompt('Reason for suspension:');
    if (reason === null) return;
    try {
      await wagApi.client.patch(`/admin/partners/${partnerId}/suspend`, { reason });
      toast({ type: 'success', title: 'Partner suspended' });
      load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
  };

  const svBadge = (s: string): any => ({ approved: 'success', pending: 'warning', suspended: 'error', rejected: 'error' }[s] ?? 'default');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[#1A0A03]">Partners</h2>
        {status === 'pending' && partners.length > 0 && (
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full">
            {partners.length} pending review
          </span>
        )}
      </div>

      <div className="flex gap-1 bg-white border border-[#E8D8CC] rounded-xl p-1 w-fit">
        {[{ v: 'pending', l: '⏳ Pending' }, { v: 'approved', l: '✅ Approved' }, { v: 'suspended', l: '🚫 Suspended' }].map(({ v, l }) => (
          <button key={v} onClick={() => setStatus(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${status === v ? 'bg-[#4A1E0B] text-white' : 'text-[#5C3D2E] hover:bg-[#FBF7F2]'}`}
          >{l}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>
              {['Name', 'Phone', 'Email', 'Modes', 'Rating', 'Jobs', 'Status', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-10 text-center"><Spinner /></td></tr>
            ) : partners.length === 0 ? (
              <tr><td colSpan={9} className="py-10 text-center text-[#9E7B6A]">No partners in this category</td></tr>
            ) : (
              partners.map((p) => (
                <tr key={p.userId} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3 font-semibold">
                    {p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.user?.phone}</td>
                  <td className="px-4 py-3 text-[#9E7B6A] text-xs">{p.user?.email ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-xs">{(p.modes as string[]).join(' & ')}</td>
                  <td className="px-4 py-3">⭐ {Number(p.rating).toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">{p.completedJobs}</td>
                  <td className="px-4 py-3"><Badge variant={svBadge(p.status)}>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-[#9E7B6A] text-xs whitespace-nowrap">{format(new Date(p.createdAt), 'd MMM yy')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {p.status === 'pending' && (
                        <Button size="sm" onClick={() => handleApprove(p.userId)}>Approve</Button>
                      )}
                      {p.status === 'approved' && (
                        <Button size="sm" variant="danger" onClick={() => handleSuspend(p.userId)}>Suspend</Button>
                      )}
                      {p.status === 'suspended' && (
                        <Button size="sm" variant="outline" onClick={() => handleApprove(p.userId)}>Reinstate</Button>
                      )}
                    </div>
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
