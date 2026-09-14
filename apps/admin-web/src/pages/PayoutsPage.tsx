import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader, Button, Badge, useToast, KpiCard, Card, CardHeader, CardTitle, Table, TableStrong, FilterChip, Toolbar } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { format, startOfMonth } from 'date-fns';

const STATUS_TONE: Record<string, any> = { paid: 'ok', approved: 'info', pending: 'muted', requested: 'warn', processing: 'accent', failed: 'danger' };

export default function PayoutsPage() {
  const { toast } = useToast();
  const { userId } = useAuthStore();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [allPayouts, setAllPayouts] = useState<any[]>([]);
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
  useEffect(() => {
    wagApi.client.get<any>('/admin/payouts?pageSize=500').then((r: any) => setAllPayouts(r.data ?? [])).catch(() => {});
  }, [payouts.length]);

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
      toast({ type: 'success', title: `Batch approved for ${selected.size} payouts` });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setProcessing(false); }
  };

  const monthStart = startOfMonth(new Date());
  const readyToRelease = allPayouts.filter((p) => ['requested', 'approved'].includes(p.status)).reduce((s, p) => s + Number(p.netAmount), 0);
  const releasedThisMonth = allPayouts.filter((p) => p.status === 'paid' && p.paidAt && new Date(p.paidAt) >= monthStart).reduce((s, p) => s + Number(p.netAmount), 0);
  const feeEarned = allPayouts.filter((p) => p.createdAt && new Date(p.createdAt) >= monthStart).reduce((s, p) => s + Number(p.commissionAmount), 0);

  return (
    <div>
      <PageHeader
        title="Payouts"
        sub={`${allPayouts.filter((p) => ['requested', 'approved'].includes(p.status)).length} pending release`}
        actions={selected.size > 0 ? (
          <Button compact onClick={approveBatch} loading={processing}>
            Approve batch &middot; ₹{payouts.filter((p) => selected.has(p.id)).reduce((s, p) => s + Number(p.netAmount), 0).toLocaleString('en-IN')}
          </Button>
        ) : undefined}
      />
      <div className="p-4 md:p-7 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <KpiCard title="Ready to release" value={`₹${readyToRelease.toLocaleString('en-IN')}`} />
          <KpiCard title="Released this month" value={`₹${releasedThisMonth.toLocaleString('en-IN')}`} />
          <KpiCard title="Platform fee earned" value={`₹${Math.round(feeEarned).toLocaleString('en-IN')}`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payout queue</CardTitle>
          </CardHeader>
          <Toolbar className="mb-3">
            {[{ v: 'requested', l: 'Requested' }, { v: 'approved', l: 'Approved' }, { v: 'paid', l: 'Paid' }, { v: 'pending', l: 'Pending' }].map((o) => (
              <FilterChip key={o.v} active={status === o.v} onClick={() => setStatus(o.v)}>{o.l}</FilterChip>
            ))}
          </Toolbar>
          <Table
            bare
            loading={loading}
            emptyMessage="No payouts in this state"
            columns={[
              { key: 'sel', header: '', render: (p: any) => (
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="w-4 h-4 accent-[#4A1E0B]" aria-label="Select payout" />
              ) },
              { key: 'partner', header: 'Partner', render: (p: any) => <TableStrong>{p.partner?.user?.profile ? `${p.partner.user.profile.firstName} ${p.partner.user.profile.lastName}` : '—'}</TableStrong> },
              { key: 'gross', header: 'Gross', align: 'right', render: (p: any) => `₹${Number(p.grossAmount).toLocaleString('en-IN')}` },
              { key: 'commission', header: 'Commission', align: 'right', render: (p: any) => <span className="text-[#B3261E]">-₹{Number(p.commissionAmount).toLocaleString('en-IN')}</span> },
              { key: 'net', header: 'Net', align: 'right', render: (p: any) => <TableStrong>₹{Number(p.netAmount).toLocaleString('en-IN')}</TableStrong> },
              { key: 'status', header: 'Status', render: (p: any) => <Badge variant={STATUS_TONE[p.status] ?? 'muted'}>{p.status}</Badge> },
              { key: 'requested', header: 'Requested', render: (p: any) => (p.requestedAt ? format(new Date(p.requestedAt), 'd MMM yy') : '—') },
              { key: 'actions', header: '', align: 'right', render: (p: any) => (
                p.status === 'approved' ? (
                  <Button compact variant="ghost" onClick={async () => {
                    try {
                      await wagApi.client.patch(`/admin/payouts/batches/${p.batchId}/pay`);
                      toast({ type: 'success', title: 'Marked as paid' });
                      load();
                    } catch {}
                  }}>Mark paid</Button>
                ) : null
              ) },
            ]}
            data={payouts}
            keyExtractor={(p: any) => p.id}
          />
        </Card>
      </div>
    </div>
  );
}
