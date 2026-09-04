import React, { useEffect, useState } from 'react';
import { Button, Badge, Modal, Input, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

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
      toast({ type: 'success', title: editing ? 'Coupon updated' : 'Coupon created 🎟' });
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[#1A0A03]">Coupons & Offers</h2>
        <Button onClick={openCreate} leftIcon={<Plus size={14} />}>New Coupon</Button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>{['Code', 'Discount', 'Services', 'Uses', 'Valid Until', 'Status', 'Actions'].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap" scope="col">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#9E7B6A]">No coupons yet</td></tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3 font-mono font-bold text-[#4A1E0B]">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.discountType === 'flat' ? `₹${c.discountValue} off` : `${c.discountValue}% off`}
                    {c.maxDiscount ? <span className="text-xs text-[#9E7B6A] ml-1">(max ₹{c.maxDiscount})</span> : null}
                  </td>
                  <td className="px-4 py-3 capitalize">{c.applicableServices.join(', ')}</td>
                  <td className="px-4 py-3">{c.timesUsed}{c.usageLimitTotal ? `/${c.usageLimitTotal}` : ''}</td>
                  <td className="px-4 py-3 text-[#9E7B6A] text-xs">{format(new Date(c.validUntil), 'd MMM yyyy')}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => toggleActive(c)} className="p-1.5 rounded-lg bg-[#FBF7F2] hover:bg-[#EDD9C4] text-[#4A1E0B]" title={c.isActive ? 'Deactivate' : 'Activate'} aria-label={c.isActive ? 'Deactivate coupon' : 'Activate coupon'}>
                        {c.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg bg-[#FBF7F2] hover:bg-[#EDD9C4] text-[#4A1E0B]" aria-label="Edit coupon"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg bg-[#FFEBEE] hover:bg-[#FFCDD2] text-[#C62828]" aria-label="Delete coupon"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Coupon' : 'New Coupon'} size="md"
        footer={<>
          <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave as any} loading={saving}>{editing ? 'Save Changes' : 'Create Coupon'}</Button>
        </>}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Code *" value={form.code} onChange={(e) => up('code', e.target.value.toUpperCase())} placeholder="SAVE200" required />
            <div>
              <label className="text-sm font-medium text-[#5C3D2E]">Discount Type *</label>
              <select className="mt-1 w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
                value={form.discountType} onChange={(e) => up('discountType', e.target.value)} aria-label="Discount type">
                <option value="flat">Flat (₹)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </div>
          </div>
          <Input label="Description *" value={form.description} onChange={(e) => up('description', e.target.value)} required />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Discount Value *" type="number" value={form.discountValue} onChange={(e) => up('discountValue', e.target.value)} placeholder="200" required />
            <Input label="Max Discount (₹)" type="number" value={form.maxDiscount} onChange={(e) => up('maxDiscount', e.target.value)} placeholder="Optional" />
            <Input label="Min Order (₹)" type="number" value={form.minOrderValue} onChange={(e) => up('minOrderValue', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#5C3D2E] block mb-2">Applicable Services</label>
            <div className="flex flex-wrap gap-2">
              {serviceOptions.map((s) => (
                <button key={s} type="button"
                  className={`px-3 py-1.5 rounded-lg border text-sm font-semibold capitalize ${form.applicableServices.includes(s) ? 'bg-[#4A1E0B] border-[#4A1E0B] text-white' : 'border-[#E8D8CC] text-[#5C3D2E]'}`}
                  onClick={() => {
                    const curr = form.applicableServices;
                    up('applicableServices', curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]);
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Usage Limit (Total)" type="number" value={form.usageLimitTotal} onChange={(e) => up('usageLimitTotal', e.target.value)} />
            <Input label="Limit per User" type="number" value={form.usageLimitPerUser} onChange={(e) => up('usageLimitPerUser', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid From *" type="date" value={form.validFrom} onChange={(e) => up('validFrom', e.target.value)} required />
            <Input label="Valid Until *" type="date" value={form.validUntil} onChange={(e) => up('validUntil', e.target.value)} required />
          </div>
        </form>
      </Modal>
    </div>
  );
}
