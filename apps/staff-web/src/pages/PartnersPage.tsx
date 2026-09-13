import React, { useEffect, useState } from 'react';
import { Badge, Button, Modal, useToast } from '@wag/ui-web';
import { wagApi, resolveMediaUrl } from '../lib/api';
import { format } from 'date-fns';

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState<any | null>(null);
  const [approving, setApproving] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    wagApi.client.get<any>(`/staff/partners?status=${status}&pageSize=50`)
      .then((r: any) => setPartners(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]);

  const handleApprove = async (partner: any) => {
    setApproving(true);
    try {
      await wagApi.client.patch(`/staff/partners/${partner.userId}/approve`);
      toast.toast({ type: 'success', title: `${partner.user?.profile?.firstName ?? 'Partner'} approved` });
      setSelected(null);
      load();
    } catch (err: any) {
      toast.toast({ type: 'error', title: 'Could not approve partner', message: err?.message });
    } finally {
      setApproving(false);
    }
  };

  const statusVariant = (s: string) => {
    const m: Record<string, any> = { approved: 'success', pending: 'warning', suspended: 'error', rejected: 'error' };
    return m[s] ?? 'default';
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold text-[#1A0A03]">Partners</h2>

      <div className="flex gap-1 bg-white border border-[#E8D8CC] rounded-xl p-1 w-fit">
        {[{ v: 'pending', l: 'Pending' }, { v: 'approved', l: 'Approved' }, { v: 'suspended', l: 'Suspended' }].map(({ v, l }) => (
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
              {['Name', 'Phone', 'City', 'Mode', 'Rating', 'Jobs', 'Status', 'Online', 'Joined', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E]" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div></td></tr>
            ) : partners.length === 0 ? (
              <tr><td colSpan={10} className="py-10 text-center text-[#9E7B6A]">No partners found</td></tr>
            ) : (
              partners.map((p) => (
                <tr key={p.userId} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3 font-semibold">
                    {p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{p.user?.phone}</td>
                  <td className="px-4 py-3">{p.city ?? '—'}</td>
                  <td className="px-4 py-3">{(p.modes as string[]).join(', ')}</td>
                  <td className="px-4 py-3">⭐ {Number(p.rating).toFixed(1)} ({p.reviewCount})</td>
                  <td className="px-4 py-3 text-center">{p.completedJobs}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3 text-[#9E7B6A]">{format(new Date(p.createdAt), 'd MMM yyyy')}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(p)}
                      className="text-[#4A1E0B] font-semibold hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Partner application"
        footer={
          selected?.status === 'pending' ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              <Button onClick={() => handleApprove(selected)} loading={approving}>Approve partner</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          )
        }
      >
        {selected && (
          <div className="flex gap-5">
            <div className="shrink-0">
              {selected.photoUrl ? (
                <img
                  src={resolveMediaUrl(selected.photoUrl)}
                  alt=""
                  className="w-24 h-24 rounded-2xl object-cover border border-[#E8D8CC]"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-[#FBF7F2] border border-[#E8D8CC] flex items-center justify-center text-3xl">
                  👤
                </div>
              )}
            </div>
            <dl className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Name" value={selected.user?.profile ? `${selected.user.profile.firstName} ${selected.user.profile.lastName}` : '—'} />
              <Field label="Status" value={<Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>} />
              <Field label="Phone" value={selected.user?.phone ?? '—'} />
              <Field label="Email" value={selected.user?.email ?? '—'} />
              <Field label="Age" value={selected.age ?? '—'} />
              <Field label="City" value={selected.city ?? '—'} />
              <Field label="Modes" value={(selected.modes as string[])?.join(', ') || '—'} />
              <Field label="Applied on" value={format(new Date(selected.createdAt), 'd MMM yyyy')} />
              <div className="col-span-2">
                <Field label="Address" value={selected.address ?? '—'} />
              </div>
              <div className="col-span-2">
                <Field label="Aadhaar number" value={selected.aadhaarNumber ?? '—'} />
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[#9E7B6A] uppercase tracking-wide">{label}</dt>
      <dd className="text-[#1A0A03] mt-0.5">{value}</dd>
    </div>
  );
}
