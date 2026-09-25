import React, { useCallback, useEffect, useState } from 'react';
import type { PartnerMoneyOverview, PlatformSettings } from '@wag/shared-types';
import { Card, CardHeader, CardTitle } from './Card.js';
import { Button } from './Button.js';
import { Input } from './Input.js';
import { Badge } from './Badge.js';
import { Kv } from './Chrome.js';
import { useToast } from './Toast.js';

// The subset of the API client these panels need (wagApi.client satisfies it).
export interface MoneyApi {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, data?: unknown): Promise<T>;
  patch<T>(url: string, data?: unknown): Promise<T>;
  put<T>(url: string, data?: unknown): Promise<T>;
}

const inr = (n: number) => `₹${Math.round(n * 100) / 100}`;
const errMsg = (e: any) => e?.response?.data?.message ?? e?.message ?? 'Something went wrong';
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const fmt = (s: string) => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Platform-wide money settings. Only the super admin can save. */
export function MoneySettingsCard({ api, canEdit }: { api: MoneyApi; canEdit: boolean }) {
  const { toast } = useToast();
  const [s, setS] = useState<PlatformSettings | null>(null);
  const [form, setForm] = useState({ defaultCommissionPct: '', commissionLimit: '', maxPartnerDiscountPct: '' });
  const [saving, setSaving] = useState(false);

  const apply = (v: PlatformSettings) => {
    setS(v);
    setForm({ defaultCommissionPct: String(v.defaultCommissionPct), commissionLimit: String(v.commissionLimit), maxPartnerDiscountPct: String(v.maxPartnerDiscountPct) });
  };
  useEffect(() => { api.get<PlatformSettings>('/commission/settings').then(apply).catch(() => {}); }, [api]);

  const save = async () => {
    setSaving(true);
    try {
      apply(await api.put<PlatformSettings>('/commission/settings', {
        defaultCommissionPct: Number(form.defaultCommissionPct),
        commissionLimit: Number(form.commissionLimit),
        maxPartnerDiscountPct: Number(form.maxPartnerDiscountPct),
      }));
      toast({ type: 'success', title: 'Settings saved' });
    } catch (e) {
      toast({ type: 'error', title: 'Could not save', message: errMsg(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Commission &amp; dues</CardTitle></CardHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input label="Default company commission (%)" type="number" min={0} max={90} value={form.defaultCommissionPct} disabled={!canEdit}
          hint={s ? `Partners keep ${100 - Number(form.defaultCommissionPct || 0)}% unless set per partner` : undefined}
          onChange={(e) => setForm({ ...form, defaultCommissionPct: e.target.value })} />
        <Input label="Commission limit (₹)" type="number" min={1} value={form.commissionLimit} disabled={!canEdit}
          hint="At this much owed, a partner sees no jobs until they pay"
          onChange={(e) => setForm({ ...form, commissionLimit: e.target.value })} />
        <Input label="Max partner discount (%)" type="number" min={0} max={90} value={form.maxPartnerDiscountPct} disabled={!canEdit}
          hint="Highest discount staff may activate"
          onChange={(e) => setForm({ ...form, maxPartnerDiscountPct: e.target.value })} />
      </div>
      {canEdit ? (
        <div className="mt-4"><Button onClick={save} loading={saving}>Save</Button></div>
      ) : (
        <p className="mt-3 text-[13px] text-[#6E5B4B]">Only the super admin can change these.</p>
      )}
    </Card>
  );
}

/** Commission split, discount and dues of one partner. Staff and admin can manage most of it. */
export function PartnerMoneyPanel({ api, partnerId, isAdmin }: { api: MoneyApi; partnerId: string; isAdmin: boolean }) {
  const { toast } = useToast();
  const [o, setO] = useState<PartnerMoneyOverview | null>(null);
  const [pct, setPct] = useState('');
  const [limit, setLimit] = useState('');
  const now = new Date();
  const [disc, setDisc] = useState({ percent: '', startsAt: toLocalInput(now), endsAt: toLocalInput(new Date(now.getTime() + 30 * 86400000)), note: '' });
  const [pay, setPay] = useState({ amount: '', note: '' });
  const [adj, setAdj] = useState({ amount: '', note: '' });
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api.get<PartnerMoneyOverview>(`/commission/partners/${partnerId}`).then((v) => {
      setO(v);
      setPct(v.commissionPct == null ? '' : String(v.commissionPct));
      setLimit(v.commissionLimitOverride == null ? '' : String(v.commissionLimitOverride));
    }).catch(() => {});
  }, [api, partnerId]);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast({ type: 'success', title: ok });
      load();
    } catch (e) {
      toast({ type: 'error', title: 'Not saved', message: errMsg(e) });
    } finally {
      setBusy('');
    }
  };

  if (!o) return <Card><p className="text-[13px] text-[#6E5B4B]">Loading money details…</p></Card>;
  const eff = o.effective;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Commission split</CardTitle></CardHeader>
        <Kv k="Current split (partner / company)" v={`${eff.partnerPct} / ${eff.commissionPct}`} />
        <Kv k="Platform default" v={`${100 - o.defaults.defaultCommissionPct} / ${o.defaults.defaultCommissionPct}`} />
        <div className="flex flex-wrap items-end gap-3 mt-3">
          <div className="w-56">
            <Input label="Company share for this partner (%)" type="number" min={0} max={90} value={pct} placeholder="Use default"
              onChange={(e) => setPct(e.target.value)} hint="e.g. 30 = 70/30, 20 = 80/20. Blank = platform default" />
          </div>
          <Button loading={busy === 'pct'} onClick={() => run('pct', () => api.patch(`/commission/partners/${partnerId}`, { commissionPct: pct === '' ? null : Number(pct) }), 'Commission updated')}>Save</Button>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-3 mt-4">
            <div className="w-56">
              <Input label="Commission limit override (₹)" type="number" min={1} value={limit} placeholder={`Default ${o.defaults.commissionLimit}`}
                onChange={(e) => setLimit(e.target.value)} />
            </div>
            <Button variant="outline" loading={busy === 'limit'} onClick={() => run('limit', () => api.patch(`/commission/partners/${partnerId}`, { commissionLimitOverride: limit === '' ? null : Number(limit) }), 'Limit updated')}>Save limit</Button>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discount offered to customers</CardTitle>
          {o.activeDiscount ? <Badge variant="ok">{Number(o.activeDiscount.percent)}% active</Badge> : <Badge variant="muted">None active</Badge>}
        </CardHeader>
        <p className="text-[13px] text-[#6E5B4B] mb-3">
          Applied to the service price when this partner accepts a job, only between the dates below. Activating it is the approval. Max {o.defaults.maxPartnerDiscountPct}%.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input label="Percent off" type="number" min={0} max={o.defaults.maxPartnerDiscountPct} value={disc.percent} onChange={(e) => setDisc({ ...disc, percent: e.target.value })} />
          <Input label="From" type="datetime-local" value={disc.startsAt} onChange={(e) => setDisc({ ...disc, startsAt: e.target.value })} />
          <Input label="Until" type="datetime-local" value={disc.endsAt} onChange={(e) => setDisc({ ...disc, endsAt: e.target.value })} />
          <Input label="Note" value={disc.note} onChange={(e) => setDisc({ ...disc, note: e.target.value })} placeholder="e.g. New partner offer" />
        </div>
        <div className="mt-3">
          <Button loading={busy === 'disc'} disabled={!disc.percent}
            onClick={() => run('disc', () => api.post(`/commission/partners/${partnerId}/discounts`, {
              percent: Number(disc.percent), startsAt: new Date(disc.startsAt).toISOString(), endsAt: new Date(disc.endsAt).toISOString(), note: disc.note || undefined,
            }), 'Discount activated')}>Activate discount</Button>
        </div>
        {o.discounts.length > 0 && (
          <div className="mt-4 divide-y divide-[#F0E8DC]">
            {o.discounts.map((d) => {
              const live = d.status === 'active' && new Date(d.startsAt).getTime() <= Date.now() && new Date(d.endsAt).getTime() >= Date.now();
              const over = new Date(d.endsAt).getTime() < Date.now();
              return (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="text-[13px]">
                    <b>{Number(d.percent)}%</b> · {fmt(d.startsAt)} → {fmt(d.endsAt)}{d.note ? ` · ${d.note}` : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={live ? 'ok' : over ? 'muted' : d.status === 'active' ? 'warn' : 'muted'}>{live ? 'Live' : over ? 'Ended' : d.status === 'active' ? 'Scheduled' : 'Off'}</Badge>
                    {!over && (
                      <Button compact variant="outline" loading={busy === d.id}
                        onClick={() => run(d.id, () => api.patch(`/commission/discounts/${d.id}`, { status: d.status === 'active' ? 'inactive' : 'active' }), d.status === 'active' ? 'Discount deactivated' : 'Discount activated')}>
                        {d.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission owed</CardTitle>
          {eff.blocked ? <Badge variant="danger">Jobs paused</Badge> : eff.warning ? <Badge variant="warn">Near limit</Badge> : <Badge variant="ok">OK</Badge>}
        </CardHeader>
        <Kv k="Owed to the company" v={inr(eff.due)} />
        <Kv k="Limit" v={inr(eff.limit)} />
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col gap-2">
              <b className="text-[13px]">Record a payment received outside the app</b>
              <Input label="Amount (₹)" type="number" min={1} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
              <Input label="Reference" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} placeholder="Bank transfer ref, etc." />
              <div><Button variant="outline" loading={busy === 'pay'} disabled={!pay.amount}
                onClick={() => run('pay', () => api.post(`/commission/partners/${partnerId}/dues/offline`, { amount: Number(pay.amount), note: pay.note }).then(() => setPay({ amount: '', note: '' })), 'Payment recorded')}>Record payment</Button></div>
            </div>
            <div className="flex flex-col gap-2">
              <b className="text-[13px]">Correction (+ raises, − lowers the amount owed)</b>
              <Input label="Amount (₹)" type="number" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} />
              <Input label="Reason (required)" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
              <div><Button variant="outline" loading={busy === 'adj'} disabled={!adj.amount || adj.note.trim().length < 3}
                onClick={() => run('adj', () => api.post(`/commission/partners/${partnerId}/dues/adjust`, { amount: Number(adj.amount), note: adj.note }).then(() => setAdj({ amount: '', note: '' })), 'Adjustment saved')}>Apply correction</Button></div>
            </div>
          </div>
        )}
        {o.ledger.length > 0 && (
          <div className="mt-4">
            <b className="text-[13px]">Recent activity</b>
            <div className="divide-y divide-[#F0E8DC] mt-1">
              {o.ledger.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="text-[#6E5B4B]">{fmt(l.createdAt)} · {l.type.replace(/_/g, ' ')}{l.note ? ` · ${l.note}` : ''}</span>
                  <b className={l.amount > 0 ? 'text-[#B3261E]' : 'text-[#1F7A45]'}>{l.amount > 0 ? '+' : '−'}{inr(Math.abs(l.amount))}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
