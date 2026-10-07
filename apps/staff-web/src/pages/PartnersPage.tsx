import React, { useEffect, useState } from 'react';
import { PageHeader, Badge, Button, Modal, useToast, FilterChip, Toolbar, Card, Table, TableStrong, RatingChip, Icon, PartnerMoneyPanel, ToolMediaGallery, PartnerTypeBadge, PartnerTypePicker, PARTNER_TYPE_FILTERS, type ToolsData, type PartnerEmploymentType, type PartnerTypeFilter } from '@wag/ui-web';
import { wagApi, resolveMediaUrl } from '../lib/api';
import { format } from 'date-fns';

const STATUS_TONE: Record<string, any> = { approved: 'ok', pending: 'warn', suspended: 'danger', rejected: 'danger' };

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('pending');
  const [type, setType] = useState<PartnerTypeFilter>('');
  // Chosen in the application dialog: approving needs it, and approved partners can be moved between lists.
  const [pickType, setPickType] = useState<PartnerEmploymentType | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [approving, setApproving] = useState(false);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    wagApi.client.get<any>(`/staff/partners?status=${status}${type ? `&employmentType=${type}` : ''}&pageSize=50`)
      .then((r: any) => setPartners(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [status, type]);
  useEffect(() => { setPickType(selected?.employmentType ?? null); }, [selected]);

  const changeType = async (partner: any, next: PartnerEmploymentType) => {
    setPickType(next);
    if (partner.status === 'pending') return; // saved together with the approval
    setSavingType(true);
    try {
      await wagApi.client.patch(`/staff/partners/${partner.userId}/employment-type`, { employmentType: next });
      toast({ type: 'success', title: next === 'team' ? 'Moved to My team' : 'Marked as freelancer' });
      setSelected((s: any) => (s ? { ...s, employmentType: next } : s));
      load();
    } catch (err: any) {
      setPickType(partner.employmentType ?? null);
      toast({ type: 'error', title: 'Could not change the partner type', message: err?.message });
    } finally {
      setSavingType(false);
    }
  };

  const [tools, setTools] = useState<ToolsData | null>(null);

  const handleApprove = async (partner: any) => {
    setApproving(true);
    try {
      if (!pickType) { toast({ type: 'error', title: 'Choose My team or Freelancer first' }); return; }
      await wagApi.client.patch(`/staff/partners/${partner.userId}/approve`, { employmentType: pickType });
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
          {status !== 'pending' && (
            <>
              <span className="w-px h-6 bg-[#EDE4D9] mx-1" aria-hidden />
              {PARTNER_TYPE_FILTERS.map((o) => (
                <FilterChip key={o.v || 'all'} active={type === o.v} onClick={() => setType(o.v)}>{o.l}</FilterChip>
              ))}
            </>
          )}
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
                { key: 'type', header: 'Type', render: (p: any) => (p.status === 'pending' ? '—' : <PartnerTypeBadge type={p.employmentType} />) },
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
        onClose={() => { setSelected(null); setTools(null); }}
        title="Partner application"
        size="lg"
        footer={
          selected?.status === 'pending' ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              <Button onClick={() => handleApprove(selected)} loading={approving} disabled={!pickType || (tools !== null && !tools.complete)}>Approve partner</Button>
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
              <Field label="Role" value={roleLabel(selected.modes)} />
              <Field label="Applied on" value={format(new Date(selected.createdAt), 'd MMM yyyy')} />
              <div className="col-span-2"><Field label="Address" value={selected.address ?? '—'} /></div>
              <div className="col-span-2">
                <Field
                  label="Aadhaar"
                  value={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span>{selected.aadhaarLast4 ? `XXXX XXXX ${selected.aadhaarLast4}` : '—'}</span>
                      {selected.kycStatus === 'verified' ? (
                        <Badge variant="ok">Verified via DigiLocker{selected.kycVerifiedAt ? ` ${format(new Date(selected.kycVerifiedAt), 'd MMM yyyy')}` : ''}</Badge>
                      ) : (
                        <Badge variant="warn">Not DigiLocker-verified (legacy)</Badge>
                      )}
                    </span>
                  }
                />
              </div>
              {selected.kycStatus === 'verified' && (
                <div className="col-span-2 rounded-xl bg-[#F9F1E9] p-3">
                  <div className="text-xs font-semibold text-[#9A8878] uppercase tracking-wide mb-1">Name on Aadhaar</div>
                  <div className="text-[#1C1006]">
                    {selected.kycName}
                    {selected.kycDob ? ` · born ${format(new Date(selected.kycDob), 'd MMM yyyy')}` : ''}
                  </div>
                  {selected.kycNameMatch === false && (
                    <div className="mt-2 text-xs font-semibold text-[#B4520F]">
                      This does not match the name entered at sign-up. Check before approving.
                    </div>
                  )}
                </div>
              )}
            </dl>
          </div>
        )}
        {selected && (selected.status === 'pending' || selected.status === 'approved') && (
          <div className="mt-5">
            <div className="text-xs font-semibold text-[#9A8878] uppercase tracking-wide mb-2">
              {selected.status === 'pending' ? 'Approve as' : 'Partner type'}
            </div>
            <PartnerTypePicker value={pickType} onChange={(v) => changeType(selected, v)} disabled={savingType} />
          </div>
        )}
        {selected && (
          <div className="mt-5">
            <ToolMediaGallery api={wagApi.client} path={`/staff/partners/${selected.userId}/tools`} resolveUrl={resolveMediaUrl as any} onLoaded={setTools} />
          </div>
        )}

        {selected && selected.status === 'approved' && (
          <div className="mt-5"><PartnerMoneyPanel api={wagApi.client} partnerId={selected.userId} isAdmin={false} /></div>
        )}
      </Modal>
    </div>
  );
}

function roleLabel(modes: string[] | undefined): string {
  const m = modes ?? [];
  if (m.includes('grooming') && m.includes('walking')) return 'Groomer and walker';
  if (m.includes('grooming')) return 'Groomer';
  if (m.includes('walking')) return 'Walker';
  return '—';
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[#9A8878] uppercase tracking-wide">{label}</dt>
      <dd className="text-[#1C1006] mt-0.5">{value}</dd>
    </div>
  );
}
