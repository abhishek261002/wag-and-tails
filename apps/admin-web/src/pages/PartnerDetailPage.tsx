import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, KpiCard, Card, CardHeader, CardTitle, Table, Badge, Button, Icon, useToast, RatingChip, PartnerMoneyPanel } from '@wag/ui-web';
import { wagApi, resolveMediaUrl } from '../lib/api';
import { format } from 'date-fns';
import { useAuthStore } from '../store/auth.store';

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId } = useAuthStore();
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!id) return;
    wagApi.client.get<any>(`/admin/partners/${id}`).then(setPartner).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      await wagApi.client.patch(`/admin/partners/${id}/approve`, { adminId: userId });
      toast({ type: 'success', title: 'Partner approved' });
      load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
  };

  const handleSuspend = async () => {
    const reason = window.prompt('Reason for suspension:');
    if (reason === null || !id) return;
    try {
      await wagApi.client.patch(`/admin/partners/${id}/suspend`, { reason });
      toast({ type: 'success', title: 'Partner suspended' });
      load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
  };

  if (loading) return <div className="flex justify-center py-20 text-[#9A8878]">Loading…</div>;
  if (!partner) return <div className="flex justify-center py-20 text-[#9A8878]">Partner not found</div>;

  const name = partner.user?.profile ? `${partner.user.profile.firstName} ${partner.user.profile.lastName}` : '—';

  const documents = [
    {
      name: 'Aadhaar',
      sub: partner.aadhaarLast4
        ? `XXXX XXXX ${partner.aadhaarLast4}${partner.kycStatus === 'verified' ? ' · verified via DigiLocker' : ' · not DigiLocker-verified (legacy)'}`
        : 'Not submitted',
      ok: partner.kycStatus === 'verified',
    },
    ...(partner.kycStatus === 'verified'
      ? [{ name: 'Name on Aadhaar', sub: partner.kycName + (partner.kycNameMatch === false ? ' (does not match sign-up name)' : ''), ok: partner.kycNameMatch !== false }]
      : []),
    { name: 'Photo ID', sub: partner.photoUrl ? 'Uploaded' : 'Not submitted', ok: !!partner.photoUrl },
    { name: 'Address', sub: partner.address ?? 'Not submitted', ok: !!partner.address },
    { name: 'Age verification', sub: partner.age ? `${partner.age} years` : 'Not submitted', ok: !!partner.age },
  ];

  return (
    <div>
      <PageHeader
        title={name}
        sub={`${(partner.modes ?? []).join(', ')} · ${partner.city ?? '—'}`}
        actions={
          <>
            {partner.status === 'pending' && <Button compact onClick={handleApprove}>Approve partner</Button>}
            <Button compact variant="ghost" onClick={() => navigate('/partners')}>Back</Button>
          </>
        }
      />
      <div className="p-4 md:p-7 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Jobs completed" value={partner.completedJobs ?? 0} />
          <KpiCard title="Rating" value={partner.rating ? Number(partner.rating).toFixed(1) : '—'} />
          <KpiCard title="Review count" value={partner.reviewCount ?? 0} />
          <KpiCard title="Status" value={<Badge variant={partner.status === 'approved' ? 'ok' : partner.status === 'pending' ? 'warn' : 'danger'}>{partner.status}</Badge>} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              {partner.photoUrl && <RatingChip value={Number(partner.rating).toFixed(1)} />}
            </CardHeader>
            <Table
              bare
              columns={[
                { key: 'name', header: 'Document', render: (d: any) => <span className="font-semibold">{d.name}</span> },
                { key: 'sub', header: 'Detail', render: (d: any) => d.sub },
                { key: 'status', header: 'Status', render: (d: any) => <Badge variant={d.ok ? 'ok' : 'warn'}>{d.ok ? 'Verified' : 'Missing'}</Badge> },
              ]}
              data={documents}
              keyExtractor={(d: any) => d.name}
            />
            {partner.photoUrl && (
              <div className="mt-4">
                <img src={resolveMediaUrl(partner.photoUrl)} alt="" className="w-28 h-28 rounded-2xl object-cover border border-[#EDE4D9]" />
              </div>
            )}
          </Card>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <div className="flex flex-col gap-2">
              {partner.user?.phone && (
                <a href={`tel:${partner.user.phone}`} className="w-full inline-flex items-center gap-[7px] px-[14px] py-[9px] rounded-[9px] text-[13px] font-semibold bg-white border border-[#E2D5C6] text-[#1C1006] hover:bg-[#F4EDE5] transition-colors">
                  <Icon name="phone" size={15} /> Call partner
                </a>
              )}
              <Button compact variant="ghost" className="!justify-start" leftIcon={<Icon name="wallet" size={15} />} onClick={() => navigate('/payouts')}>
                View payouts
              </Button>
              {partner.status === 'approved' && (
                <Button compact variant="danger" className="!justify-start" leftIcon={<Icon name="close" size={15} />} onClick={handleSuspend}>
                  Suspend partner
                </Button>
              )}
              {partner.status === 'suspended' && (
                <Button compact className="!justify-start" leftIcon={<Icon name="check" size={15} />} onClick={handleApprove}>
                  Reinstate partner
                </Button>
              )}
            </div>
          </Card>
        </div>
        <div className="mt-4">
          <PartnerMoneyPanel api={wagApi.client} partnerId={partner.userId} isAdmin />
        </div>
      </div>
    </div>
  );
}
