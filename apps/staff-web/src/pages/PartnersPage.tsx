import React, { useEffect, useState } from 'react';
import { PageHeader, Badge, Button, Modal, useToast, FilterChip, Toolbar, Card, Table, TableStrong, RatingChip, Icon } from '@wag/ui-web';
import { wagApi, resolveMediaUrl } from '../lib/api';
import { format } from 'date-fns';

const STATUS_TONE: Record<string, any> = { approved: 'ok', pending: 'warn', suspended: 'danger', rejected: 'danger' };

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState<any | null>(null);
  const [approving, setApproving] = useState(false);
  const { toast } = useToast();

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
      toast({ type: 'success', title: `${partner.user?.profile?.firstName ?? 'Partner'} approved` });
      setSelected(null);
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Could not approve partner', message: err?.message });
    } finally {
      setApproving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Partners" sub={`${partners.length} in this view`} />
      <div className="p-4 md:p-7">
        <Toolbar>
          {[{ v: 'pending', l: 'Pending' }, { v: 'approved', l: 'Approved' }, { v: 'suspended', l: 'Suspended' }].map((o) => (
            <FilterChip key={o.v} active={status === o.v} onClick={() => setStatus(o.v)}>{o.l}</FilterChip>
          ))}
        </Toolbar>

        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              loading={loading}
              emptyMessage="No partners in this category"
              columns={[
                { key: 'name', header: 'Name', render: (p: any) => <TableStrong>{p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : '—'}</TableStrong> },
                { key: 'phone', header: 'Phone', render: (p: any) => p.user?.phone },
                { key: 'city', header: 'City', render: (p: any) => p.city ?? '—' },
                { key: 'mode', header: 'Mode', render: (p: any) => (p.modes as string[]).join(', ') },
                { key: 'rating', header: 'Rating', render: (p: any) => <RatingChip value={Number(p.rating).toFixed(1)} /> },
                { key: 'jobs', header: 'Jobs', align: 'center', render: (p: any) => p.completedJobs },
                { key: 'status', header: 'Status', render: (p: any) => <Badge variant={STATUS_TONE[p.status] ?? 'muted'}>{p.status}</Badge> },
                { key: 'joined', header: 'Joined', render: (p: any) => format(new Date(p.createdAt), 'd MMM yyyy') },
                { key: 'action', header: '', align: 'right', render: (p: any) => (
                  <Button compact variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(p); }}>View</Button>
                ) },
              ]}
              data={partners}
              keyExtractor={(p: any) => p.userId}
              onRowClick={(p: any) => setSelected(p)}
            />
          </div>
        </Card>
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
                <img src={resolveMediaUrl(selected.photoUrl)} alt="" className="w-24 h-24 rounded-2xl object-cover border border-[#EDE4D9]" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-[#FBF7F2] border border-[#EDE4D9] grid place-items-center text-[#9A8878]">
                  <Icon name="user" size={28} />
                </div>
              )}
            </div>
            <dl className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Name" value={selected.user?.profile ? `${selected.user.profile.firstName} ${selected.user.profile.lastName}` : '—'} />
              <Field label="Status" value={<Badge variant={STATUS_TONE[selected.status] ?? 'muted'}>{selected.status}</Badge>} />
              <Field label="Phone" value={selected.user?.phone ?? '—'} />
              <Field label="Email" value={selected.user?.email ?? '—'} />
              <Field label="Age" value={selected.age ?? '—'} />
              <Field label="City" value={selected.city ?? '—'} />
              <Field label="Modes" value={(selected.modes as string[])?.join(', ') || '—'} />
              <Field label="Applied on" value={format(new Date(selected.createdAt), 'd MMM yyyy')} />
              <div className="col-span-2"><Field label="Address" value={selected.address ?? '—'} /></div>
              <div className="col-span-2"><Field label="Aadhaar number" value={selected.aadhaarNumber ?? '—'} /></div>
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
      <dt className="text-xs font-semibold text-[#9A8878] uppercase tracking-wide">{label}</dt>
      <dd className="text-[#1C1006] mt-0.5">{value}</dd>
    </div>
  );
}
