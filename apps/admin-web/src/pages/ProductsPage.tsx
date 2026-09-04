import React, { useEffect, useState } from 'react';
import { Button, Modal, Input, Badge, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { Plus, Pencil } from 'lucide-react';

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      wagApi.store.listProducts({ categoryId: catFilter || undefined }),
      wagApi.store.listCategories(),
    ]).then(([p, c]) => { setProducts(p.data); setCategories(c); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [catFilter]);

  const up = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, mrp: Number(form.mrp), retailPrice: Number(form.retailPrice), tradePrice: Number(form.tradePrice) };
      if (editing) await wagApi.client.patch(`/admin/products/${editing.id}`, body);
      else await wagApi.client.post('/admin/products', body);
      toast({ type: 'success', title: editing ? 'Product updated' : 'Product created 📦' });
      setModal(false); load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[#1A0A03]">Products</h2>
        <Button onClick={() => { setEditing(null); setForm({ categoryId: categories[0]?.id ?? '', name: '', slug: '', mrp: '', retailPrice: '', tradePrice: '', description: '', isActive: true }); setModal(true); }} leftIcon={<Plus size={14} />}>Add Product</Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 bg-white border border-[#E8D8CC] rounded-xl p-1 w-fit flex-wrap">
        <button onClick={() => setCatFilter('')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${!catFilter ? 'bg-[#4A1E0B] text-white' : 'text-[#5C3D2E] hover:bg-[#FBF7F2]'}`}>All</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCatFilter(c.id)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${catFilter === c.id ? 'bg-[#4A1E0B] text-white' : 'text-[#5C3D2E] hover:bg-[#FBF7F2]'}`}>{c.name}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>{['Product', 'Category', 'MRP', 'Retail', 'Trade', 'Rating', 'Status', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap" scope="col">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div></td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-[#9E7B6A]">No products found</td></tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3 font-semibold max-w-[200px]"><p className="truncate">{p.name}</p></td>
                  <td className="px-4 py-3 text-[#9E7B6A] text-xs">{p.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 line-through text-[#9E7B6A]">₹{p.mrp}</td>
                  <td className="px-4 py-3 font-bold text-[#4A1E0B]">₹{p.retailPrice}</td>
                  <td className="px-4 py-3 font-bold text-green-700">₹{p.tradePrice}</td>
                  <td className="px-4 py-3">⭐ {Number(p.rating).toFixed(1)} ({p.reviewCount})</td>
                  <td className="px-4 py-3"><Badge variant={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditing(p); setForm({ ...p, mrp: String(p.mrp), retailPrice: String(p.retailPrice), tradePrice: String(p.tradePrice) }); setModal(true); }}
                      className="p-1 rounded hover:bg-[#FBF7F2]" aria-label="Edit product"><Pencil size={14} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Product' : 'New Product'} size="lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancel</Button><Button onClick={handleSave as any} loading={saving}>Save</Button></>}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name *" value={form.name ?? ''} onChange={(e) => up('name', e.target.value)} required />
            <Input label="Slug *" value={form.slug ?? ''} onChange={(e) => up('slug', e.target.value)} required hint="URL-friendly unique key" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#5C3D2E]">Category *</label>
            <select className="mt-1 w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
              value={form.categoryId ?? ''} onChange={(e) => up('categoryId', e.target.value)} aria-label="Category">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="MRP (₹) *" type="number" value={form.mrp ?? ''} onChange={(e) => up('mrp', e.target.value)} required />
            <Input label="Retail Price (₹) *" type="number" value={form.retailPrice ?? ''} onChange={(e) => up('retailPrice', e.target.value)} required />
            <Input label="Trade Price (₹) *" type="number" value={form.tradePrice ?? ''} onChange={(e) => up('tradePrice', e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-[#5C3D2E]">Description</label>
            <textarea className="mt-1 w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] resize-none"
              rows={3} value={form.description ?? ''} onChange={(e) => up('description', e.target.value)} aria-label="Product description" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive ?? true} onChange={(e) => up('isActive', e.target.checked)} className="w-4 h-4 accent-[#4A1E0B]" />
            <label htmlFor="isActive" className="text-sm font-medium text-[#5C3D2E]">Active (visible in store)</label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
