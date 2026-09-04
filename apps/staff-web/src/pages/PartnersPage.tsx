import React, { useEffect, useState } from 'react';
import { Badge } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('approved');

  useEffect(() => {
    setLoading(true);
    wagApi.client.get<any>(`/staff/partners?status=${status}&pageSize=50`)
      .then((r: any) => setPartners(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const statusVariant = (s: string) => {
    const m: Record<string, any> = { approved: 'success', pending: 'warning', suspended: 'error', rejected: 'error' };
    return m[s] ?? 'default';
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold text-[#1A0A03]">Partners</h2>

      <div className="flex gap-1 bg-white border border-[#E8D8CC] rounded-xl p-1 w-fit">
        {[{ v: 'approved', l: 'Approved' }, { v: 'pending', l: 'Pending' }, { v: 'suspended', l: 'Suspended' }].map(({ v, l }) => (
          <button
            key={v}
            onClick={() => setStatus(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${status === v ? 'bg-[#4A1E0B] text-white' : 'text-[#5C3D2E] hover:bg-[#FBF7F2]'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>
              {['Name', 'Phone', 'Mode', 'Rating', 'Jobs', 'Status', 'Online', 'Joined'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E]" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div></td></tr>
            ) : partners.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-[#9E7B6A]">No partners found</td></tr>
            ) : (
              partners.map((p) => (
                <tr key={p.userId} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3 font-semibold">
                    {p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{p.user?.phone}</td>
                  <td className="px-4 py-3">{(p.modes as string[]).join(', ')}</td>
                  <td className="px-4 py-3">⭐ {Number(p.rating).toFixed(1)} ({p.reviewCount})</td>
                  <td className="px-4 py-3 text-center">{p.completedJobs}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3 text-[#9E7B6A]">{format(new Date(p.createdAt), 'd MMM yyyy')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
