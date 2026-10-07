import React, { useCallback, useEffect, useState } from 'react';
import {
  INSURANCE_CALL_TIME_LABEL, INSURANCE_COVER_LABEL, INSURANCE_PLAN_LABEL, INSURANCE_STATUSES, INSURANCE_STATUS_LABEL,
  type InsuranceRequestStatus, type PetInsuranceRequest,
} from '@wag/shared-types';
import { Card } from './Card.js';
import { Button } from './Button.js';
import { Badge, type BadgeVariant } from './Badge.js';
import { Modal } from './Modal.js';
import { Table, TableStrong } from './Table.js';
import { FilterChip, Toolbar, PageHeader } from './Chrome.js';
import { useToast } from './Toast.js';
import type { MoneyApi } from './Money.js';

const TONE: Record<InsuranceRequestStatus, BadgeVariant> = { new: 'warn', contacted: 'info', closed: 'muted' };

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

interface ListResponse { data: PetInsuranceRequest[]; total: number; byStatus: Record<InsuranceRequestStatus, number> }

/**
 * Pet insurance quote requests from the customer app, for staff and admin to call back. Filter by status, search,
 * open one to see everything the customer entered, then mark it contacted or closed with a note.
 */
export function InsuranceRequestsPanel({ api }: { api: MoneyApi }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<InsuranceRequestStatus | ''>('new');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [res, setRes] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<PetInsuranceRequest | null>(null);
  const [nextStatus, setNextStatus] = useState<InsuranceRequestStatus>('new');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (status) params.set('status', status);
      if (query) params.set('search', query);
      setRes(await api.get<ListResponse>(`/insurance/requests?${params.toString()}`));
    } catch (err: any) {
      toast({ type: 'error', title: 'Could not load insurance requests', message: err?.message });
    } finally {
      setLoading(false);
    }
  }, [api, status, query, toast]);

  useEffect(() => { load(); }, [load]);
  // Search after the user pauses typing.
  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const show = (r: PetInsuranceRequest) => { setOpen(r); setNextStatus(r.status); setNote(r.staffNote ?? ''); };

  const save = async () => {
    if (!open) return;
    setSaving(true);
    try {
      await api.patch(`/insurance/requests/${open.id}`, { status: nextStatus, staffNote: note.trim() || null });
      toast({ type: 'success', title: 'Request updated' });
      setOpen(null);
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Could not update', message: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const total = res ? INSURANCE_STATUSES.reduce((s, k) => s + (res.byStatus?.[k] ?? 0), 0) : 0;

  return (
    <div>
      <PageHeader title="Pet insurance" sub="Quote requests from the customer app. Call the customer, then update the status." />
      <div className="p-4 md:p-7">
        <Toolbar>
          <FilterChip active={status === ''} onClick={() => setStatus('')}>All{res ? ` (${total})` : ''}</FilterChip>
          {INSURANCE_STATUSES.map((s) => (
            <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
              {INSURANCE_STATUS_LABEL[s]}{res ? ` (${res.byStatus?.[s] ?? 0})` : ''}
            </FilterChip>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, pet or city"
            className="ml-auto h-9 w-full sm:w-64 rounded-full border border-[#EDE4D9] bg-white px-4 text-sm outline-none focus:border-[#B4520F]"
            aria-label="Search insurance requests"
          />
        </Toolbar>

        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              loading={loading}
              emptyMessage="No insurance requests here"
              columns={[
                { key: 'when', header: 'Received', render: (r: PetInsuranceRequest) => fmtDate(r.createdAt) },
                { key: 'who', header: 'Customer', render: (r: PetInsuranceRequest) => <span><TableStrong>{r.ownerName}</TableStrong><span className="block text-xs text-[#9A8878]">{r.phone}</span></span> },
                { key: 'pet', header: 'Pet', render: (r: PetInsuranceRequest) => <span>{r.petName}<span className="block text-xs text-[#9A8878]">{r.petBreed} · {r.petSpecies}</span></span> },
                { key: 'city', header: 'City', render: (r: PetInsuranceRequest) => r.city },
                { key: 'plan', header: 'Plan', render: (r: PetInsuranceRequest) => INSURANCE_PLAN_LABEL[r.planType] ?? r.planType },
                { key: 'cover', header: 'Cover', render: (r: PetInsuranceRequest) => INSURANCE_COVER_LABEL[r.coverAmount] ?? r.coverAmount },
                { key: 'call', header: 'Call', render: (r: PetInsuranceRequest) => INSURANCE_CALL_TIME_LABEL[r.preferredCallTime] ?? r.preferredCallTime },
                { key: 'status', header: 'Status', render: (r: PetInsuranceRequest) => <Badge variant={TONE[r.status]}>{INSURANCE_STATUS_LABEL[r.status]}</Badge> },
              ]}
              data={res?.data ?? []}
              keyExtractor={(r: PetInsuranceRequest) => r.id}
              onRowClick={show}
            />
          </div>
        </Card>
      </div>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title="Insurance request"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        {open && (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Customer" value={open.ownerName} />
              <Field label="Phone" value={<a className="text-[#B4520F] font-semibold" href={`tel:${open.phone}`}>{open.phone}</a>} />
              <Field label="Email" value={open.email ?? '—'} />
              <Field label="City" value={open.city} />
              <Field label="Pet" value={`${open.petName} · ${open.petBreed} (${open.petSpecies})`} />
              <Field label="Pet born" value={fmtDay(open.petDateOfBirth)} />
              <Field label="Plan" value={INSURANCE_PLAN_LABEL[open.planType] ?? open.planType} />
              <Field label="Cover amount" value={INSURANCE_COVER_LABEL[open.coverAmount] ?? open.coverAmount} />
              <Field label="Best time to call" value={INSURANCE_CALL_TIME_LABEL[open.preferredCallTime] ?? open.preferredCallTime} />
              <Field label="Received" value={fmtDate(open.createdAt)} />
              <div className="sm:col-span-2">
                <Field label="Existing illness, injury or surgery" value={open.preExisting ? (open.preExistingDetails ?? 'Yes') : 'None'} />
              </div>
              {open.notes && <div className="sm:col-span-2"><Field label="Customer's note" value={open.notes} /></div>}
              <div className="sm:col-span-2"><Field label="Consent to be contacted" value={`Given ${fmtDate(open.consentAt)}`} /></div>
            </dl>

            <div>
              <div className="text-xs font-semibold text-[#9A8878] uppercase tracking-wide mb-2">Status</div>
              <div className="flex flex-wrap gap-2">
                {INSURANCE_STATUSES.map((s) => (
                  <FilterChip key={s} active={nextStatus === s} onClick={() => setNextStatus(s)}>{INSURANCE_STATUS_LABEL[s]}</FilterChip>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="ins-note" className="text-xs font-semibold text-[#9A8878] uppercase tracking-wide">Staff note</label>
              <textarea
                id="ins-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="e.g. Called, sent quote for comprehensive ₹50k"
                className="mt-1.5 w-full rounded-xl border border-[#EDE4D9] bg-white p-3 text-sm outline-none focus:border-[#B4520F]"
              />
              {open.handledAt && <div className="text-xs text-[#9A8878] mt-1">Last updated {fmtDate(open.handledAt)}</div>}
            </div>
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
      <dd className="text-[#1C1006] mt-0.5 break-words">{value}</dd>
    </div>
  );
}
