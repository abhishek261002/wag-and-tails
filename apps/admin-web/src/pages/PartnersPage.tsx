import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Button, Badge, useToast, Card, CardHeader, CardTitle, Table, TableStrong, RatingChip, Icon, FilterChip, Toolbar, PartnerTypeBadge, ApprovePartnerModal, PARTNER_TYPE_FILTERS, type PartnerEmploymentType, type PartnerTypeFilter } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

const STATUS_TONE: Record<string, any> = { approved: 'ok', pending: 'warn', suspended: 'danger', rejected: 'danger' };

export default function PartnersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [partners, setPartners] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [type, setType] = useState<PartnerTypeFilter>('');
  const [approveFor, setApproveFor] = useState<any | null>(null);
  const [approving, setApproving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, p] = await Promise.all([
        wagApi.client.get<any>(`/admin/partners?status=${status}${type ? `&employmentType=${type}` : ''}&pageSize=50`),
        status ? Promise.resolve(null) : wagApi.client.get<any>('/admin/partners?status=pending&pageSize=10'),
      ]);
      setPartners((all as any).data ?? []);
      if (p) setPending((p as any).data ?? []);
    } catch {} finally { setLoading(false); }
  }, [status, type]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (partnerId: string, employmentType: PartnerEmploymentType) => {
    setApproving(true);
    try {
      await wagApi.client.patch(`/admin/partners/${partnerId}/approve`, { employmentType });
      toast({ type: 'success', title: 'Partner approved' });
      setApproveFor(null);
      load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); } finally { setApproving(false); }
  };

  return (
    <div>
      <PageHeader title="Partners" sub={`${partners.length} registered`} />
      <div className="p-4 md:p-7">
        {!status && pending.length > 0 && (
          <Card className="!border-[#B4520F] mb-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="text-[#B4520F]"><Icon name="alert" size={19} /></span>
                <CardTitle>Applications awaiting approval</CardTitle>
              </div>
            </CardHeader>
            <div className="flex flex-col gap-2.5">
              {pending.map((p: any) => (
                <div key={p.userId} className="flex items-center gap-3 bg-white border border-[#EDE4D9] rounded-[18px] p-3.5">
                  <span className="w-11 h-11 rounded-full bg-[#6E5B4B] shrink-0 grid place-items-center font-bold text-white">
                    {(p.user?.profile?.firstName ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-[15px] truncate">{p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : '—'}</span>
                    <span className="block text-xs text-[#9A8878] mt-0.5">{(p.modes ?? []).join(', ')} &middot; {p.city ?? '—'} &middot; {p.kycStatus === 'verified' ? 'Aadhaar verified (DigiLocker)' : 'Aadhaar not verified'}</span>
                  </span>
                  <Button compact variant="ghost" onClick={() => navigate(`/partners/${p.userId}`)}>Review</Button>
                  <Button compact onClick={() => setApproveFor(p)}>Approve</Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Toolbar>
          {[{ v: '', l: 'All' }, { v: 'pending', l: 'Pending' }, { v: 'approved', l: 'Approved' }, { v: 'suspended', l: 'Suspended' }].map((o) => (
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
              ]}
              data={partners}
              keyExtractor={(p: any) => p.userId}
              onRowClick={(p: any) => navigate(`/partners/${p.userId}`)}
            />
          </div>
        </Card>
      </div>

      <ApprovePartnerModal
        open={!!approveFor}
        name={approveFor?.user?.profile ? `${approveFor.user.profile.firstName} ${approveFor.user.profile.lastName}` : 'partner'}
        loading={approving}
        onClose={() => setApproveFor(null)}
        onConfirm={(t) => approveFor && handleApprove(approveFor.userId, t)}
      />
    </div>
  );
}
