import React, { useEffect, useState } from 'react';
import { Button, Modal, Input, Badge, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { Plus, Pencil } from 'lucide-react';

export default function PackagesPage() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [addOns, setAddOns] = useState<any[]>([]);
  const [walkPricing, setWalkPricing] = useState<any[]>([]);
  const [modal, setModal] = useState<'package' | 'addon' | 'walk' | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      wagApi.bookings.getPackages(),
      wagApi.bookings.getAddOns(),
      wagApi.bookings.getWalkPricing(),
    ]).then(([pkgs, aos, wp]) => {
      setPackages(pkgs);
      setAddOns(aos);
      setWalkPricing(wp);
    }).catch(() => {});
  };
  useEffect(load, []);

  const up = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));

  const savePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await wagApi.client.patch(`/grooming/packages/${editing.id}`, form);
      else await wagApi.client.post('/grooming/packages', { ...form, inclusions: (form.inclusions ?? '').split('\n').filter(Boolean) });
      toast({ type: 'success', title: editing ? 'Package updated' : 'Package created ✂️' });
      setModal(null); load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
    finally { setSaving(false); }
  };

  const saveAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await wagApi.client.patch(`/grooming/add-ons/${editing.id}`, form);
      else await wagApi.client.post('/grooming/add-ons', form);
      toast({ type: 'success', title: editing ? 'Add-on updated' : 'Add-on created' });
      setModal(null); load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
    finally { setSaving(false); }
  };

  const saveWalkPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await wagApi.client.patch(`/admin/walk-pricing/${editing.id}`, { price: Number(form.price) });
      toast({ type: 'success', title: 'Walk price updated 🐾' });
      setModal(null); load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-extrabold text-[#1A0A03]">Packages & Pricing</h2>

      {/* Grooming packages */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">✂️ Grooming Packages</h3>
          <Button size="sm" onClick={() => { setEditing(null); setForm({ name: '', mrp: '', price: '', description: '', inclusions: '' }); setModal('package'); }} leftIcon={<Plus size={14} />}>Add Package</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-[#E8D8CC] p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-[#1A0A03]">{p.name}</h4>
                  <p className="text-xs text-[#9E7B6A] mt-0.5">{p.description}</p>
                </div>
                <button onClick={() => { setEditing(p); setForm({ ...p }); setModal('package'); }} className="p-1.5 rounded-lg hover:bg-[#FBF7F2]" aria-label="Edit package"><Pencil size={14} /></button>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-extrabold text-[#4A1E0B]">₹{p.price}</span>
                <span className="text-sm text-[#9E7B6A] line-through">₹{p.mrp}</span>
                <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  {Math.round((1 - p.price / p.mrp) * 100)}% off
                </span>
              </div>
              <ul className="space-y-1">
                {(p.items ?? []).slice(0, 5).map((item: any, i: number) => (
                  <li key={i} className="text-xs text-[#5C3D2E] flex gap-1.5"><span className="text-green-600">✓</span>{item.description}</li>
                ))}
                {(p.items ?? []).length > 5 && <li className="text-xs text-[#9E7B6A]">+{p.items.length - 5} more...</li>}
              </ul>
              <div className="mt-3">
                <Badge variant={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">➕ Add-ons</h3>
          <Button size="sm" onClick={() => { setEditing(null); setForm({ name: '', price: '', description: '' }); setModal('addon'); }} leftIcon={<Plus size={14} />}>Add Add-on</Button>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
              <tr>{['Name', 'Price', 'Description', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E]" scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {addOns.map((a) => (
                <tr key={a.id} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3 font-semibold">{a.name}</td>
                  <td className="px-4 py-3 font-bold text-[#4A1E0B]">₹{a.price}</td>
                  <td className="px-4 py-3 text-[#9E7B6A]">{a.description ?? '—'}</td>
                  <td className="px-4 py-3"><Badge variant={a.isActive ? 'success' : 'default'}>{a.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3"><button onClick={() => { setEditing(a); setForm({ ...a, price: String(a.price) }); setModal('addon'); }} className="p-1 rounded hover:bg-[#FBF7F2]" aria-label="Edit add-on"><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Walk pricing */}
      <section>
        <h3 className="font-bold text-lg mb-3">🐾 Walk Pricing</h3>
        <div className="flex gap-4">
          {walkPricing.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border border-[#E8D8CC] p-5 text-center min-w-[140px]">
              <p className="text-3xl font-extrabold text-[#4A1E0B]">₹{w.price}</p>
              <p className="text-sm text-[#9E7B6A] mt-1">{w.durationMinutes} minutes</p>
              <button onClick={() => { setEditing(w); setForm({ price: String(w.price) }); setModal('walk'); }}
                className="mt-3 text-xs font-semibold text-[#C25A12] hover:underline" aria-label="Edit walk price">Edit price</button>
            </div>
          ))}
        </div>
      </section>

      {/* Package modal */}
      <Modal open={modal === 'package'} onClose={() => setModal(null)} title={editing ? 'Edit Package' : 'New Package'}
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={savePackage as any} loading={saving}>Save</Button></>}>
        <form onSubmit={savePackage} className="space-y-4">
          <Input label="Name *" value={form.name ?? ''} onChange={(e) => up('name', e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="MRP (₹) *" type="number" value={form.mrp ?? ''} onChange={(e) => up('mrp', e.target.value)} required />
            <Input label="Price (₹) *" type="number" value={form.price ?? ''} onChange={(e) => up('price', e.target.value)} required />
          </div>
          <Input label="Description" value={form.description ?? ''} onChange={(e) => up('description', e.target.value)} />
          {!editing && (
            <div>
              <label className="text-sm font-medium text-[#5C3D2E]">Inclusions (one per line)</label>
              <textarea className="mt-1 w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] resize-none"
                rows={5} value={form.inclusions ?? ''} onChange={(e) => up('inclusions', e.target.value)} placeholder="Bath with shampoo&#10;Blow dry&#10;Nail trim" aria-label="Package inclusions" />
            </div>
          )}
        </form>
      </Modal>

      {/* Add-on modal */}
      <Modal open={modal === 'addon'} onClose={() => setModal(null)} title={editing ? 'Edit Add-on' : 'New Add-on'}
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveAddon as any} loading={saving}>Save</Button></>}>
        <form onSubmit={saveAddon} className="space-y-4">
          <Input label="Name *" value={form.name ?? ''} onChange={(e) => up('name', e.target.value)} required />
          <Input label="Price (₹) *" type="number" value={form.price ?? ''} onChange={(e) => up('price', e.target.value)} required />
          <Input label="Description" value={form.description ?? ''} onChange={(e) => up('description', e.target.value)} />
        </form>
      </Modal>

      {/* Walk price modal */}
      <Modal open={modal === 'walk'} onClose={() => setModal(null)} title={`Edit ${editing?.durationMinutes}min Walk Price`}
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveWalkPrice as any} loading={saving}>Update</Button></>}>
        <form onSubmit={saveWalkPrice} className="space-y-4">
          <Input label="Price (₹) *" type="number" value={form.price ?? ''} onChange={(e) => up('price', e.target.value)} required />
        </form>
      </Modal>
    </div>
  );
}
