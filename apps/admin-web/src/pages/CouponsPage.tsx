import React, { useEffect, useState } from 'react';
import { PageHeader, Button, Badge, Modal, Input, useToast, Card, Table, TableId, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

const EMPTY_FORM = {
  code: '', description: '', discountType: 'flat' as 'flat' | 'percent',
  discountValue: '', maxDiscount: '', minOrderValue: '',
  applicableServices: ['all'], usageLimitTotal: '', usageLimitPerUser: '',
  validFrom: '', validUntil: '',
};

export default function CouponsPage() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => wagApi.client.get<any[]>('/admin/coupons').then((c: any) => setCoupons(Array.isArray(c) ? c : [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      code: c.code, description: c.description,
      discountType: c.discountType, discountValue: String(c.discountValue),
      maxDiscount: c.maxDiscount ? String(c.maxDiscount) : '',
      minOrderValue: c.minOrderValue ? String(c.minOrderValue) : '',
      applicableServices: c.applicableServices,
      usageLimitTotal: c.usageLimitTotal ? String(c.usageLimitTotal) : '',
      usageLimitPerUser: c.usageLimitPerUser ? String(c.usageLimitPerUser) : '',
      validFrom: c.validFrom.slice(0, 10),
      validUntil: c.validUntil.slice(0, 10),
    });
    setModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
        usageLimitTotal: form.usageLimitTotal ? Number(form.usageLimitTotal) : undefined,
        usageLimitPerUser: form.usageLimitPerUser ? Number(form.usageLimitPerUser) : undefined,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: new Date(form.validUntil).toISOString(),
      };
      if (editing) await wagApi.client.patch(`/admin/coupons/${editing.id}`, body);
      else await wagApi.client.post('/admin/coupons', body);
      toast({ type: 'success', title: editing ? 'Coupon updated' : 'Coupon created' });
      setModal(false); load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this coupon?')) return;
    try { await wagApi.client.delete(`/admin/coupons/${id}`); toast({ type: 'success', title: 'Coupon deleted' }); load(); }
    catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
  };

  const toggleActive = async (c: any) => {
    try { await wagApi.client.patch(`/admin/coupons/${c.id}`, { isActive: !c.isActive }); load(); }
    catch {}
  };

  const up = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const serviceOptions = ['all', 'grooming', 'walking', 'store'];

  return (
    <div>
      <PageHeader
        title="Offers & coupons"
        sub={`${coupons.length} active`}
        actions={<Button compact leftIcon={<Icon name="plus" size={16} />} onClick={openCreate}>New coupon</Button>}
      />
      <div className="p-4 md:p-7">
        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              emptyMessage="No coupons yet"
              columns={[
                { key: 'code', header: 'Code', render: (c: any) => <TableId>{c.code}</TableId> },
                { key: 'discount', header: 'Offer', render: (c: any) => (
                  <div>
                    <div className="font-semibold">{c.discountType === 'flat' ? `₹${c.discountValue} off` : `${c.discountValue}% off`}</div>
                    {c.maxDiscount && <div className="text-xs text-[#9A8878]">max ₹{c.maxDiscount}</div>}
                  </div>
                ) },
                { key: 'services', header: 'Applies to', render: (c: any) => <span className="capitalize">{c.applicableServices.join(', ')}</span> },
                { key: 'exp', header: 'Expires', render: (c: any) => format(new Date(c.validUntil), 'd MMM yyyy') },
                { key: 'uses', header: 'Redeemed', align: 'right', render: (c: any) => `${c.timesUsed}${c.usageLimitTotal ? `/${c.usageLimitTotal}` : ''}` },
                { key: 'status', header: 'Status', render: (c: any) => <Badge variant={c.isActive ? 'ok' : 'muted'}>{c.isActive ? 'Active' : 'Inactive'}</Badge> },
                { key: 'actions', header: '', align: 'right', render: (c: any) => (
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => toggleActive(c)} className="p-2 rounded-lg bg-[#F4EDE5] hover:bg-[#F0E2D4] text-[#4A1E0B]" title={c.isActive ? 'Deactivate' : 'Activate'} aria-label={c.isActive ? 'Deactivate coupon' : 'Activate coupon'}>
                      <Icon name={c.isActive ? 'check' : 'close'} size={14} />
                    </button>
                    <button onClick={() => openEdit(c)} className="p-2 rounded-lg bg-[#F4EDE5] hover:bg-[#F0E2D4] text-[#4A1E0B]" aria-label="Edit coupon"><Icon name="edit" size={14} /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg bg-[#FCECEA] hover:bg-[#FBE0DD] text-[#B3261E]" aria-label="Delete coupon"><Icon name="trash" size={14} /></button>
                  </div>
                ) },
              ]}
              data={coupons}
              keyExtractor={(c: any) => c.id}
            />
          </div>
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit coupon' : 'New coupon'} size="md"
        footer={<>
          <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave as any} loading={saving}>{editing ? 'Save changes' : 'Create coupon'}</Button>
        </>}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Code *" value={form.code} onChange={(e) => up('code', e.target.value.toUpperCase())} placeholder="SAVE200" required />
            <div>
              <label className="text-sm font-medium text-[#4A3A2C]">Discount type *</label>
              <select className="mt-1 w-full border border-[#E2D5C6] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
                value={form.discountType} onChange={(e) => up('discountType', e.target.value)} aria-label="Discount type">
                <option value="flat">Flat (₹)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </div>
          </div>
          <Input label="Description *" value={form.description} onChange={(e) => up('description', e.target.value)} required />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Discount value *" type="number" value={form.discountValue} onChange={(e) => up('discountValue', e.target.value)} placeholder="200" required />
            <Input label="Max discount (₹)" type="number" value={form.maxDiscount} onChange={(e) => up('maxDiscount', e.target.value)} placeholder="Optional" />
            <Input label="Min order (₹)" type="number" value={form.minOrderValue} onChange={(e) => up('minOrderValue', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#4A3A2C] block mb-2">Applicable services</label>
            <div className="flex flex-wrap gap-2">
              {serviceOptions.map((s) => (
                <button key={s} type="button"
                  className={`px-3 py-1.5 rounded-lg border text-sm font-semibold capitalize ${form.applicableServices.includes(s) ? 'bg-[#4A1E0B] border-[#4A1E0B] text-white' : 'border-[#E2D5C6] text-[#4A3A2C]'}`}
                  onClick={() => {
                    const curr = form.applicableServices;
                    up('applicableServices', curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]);
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Usage limit (total)" type="number" value={form.usageLimitTotal} onChange={(e) => up('usageLimitTotal', e.target.value)} />
            <Input label="Limit per user" type="number" value={form.usageLimitPerUser} onChange={(e) => up('usageLimitPerUser', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid from *" type="date" value={form.validFrom} onChange={(e) => up('validFrom', e.target.value)} required />
            <Input label="Valid until *" type="date" value={form.validUntil} onChange={(e) => up('validUntil', e.target.value)} required />
          </div>
        </form>
      </Modal>
    </div>
  );
}
