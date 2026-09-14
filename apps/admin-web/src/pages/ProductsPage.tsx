import React, { useEffect, useState } from 'react';
import { PageHeader, Button, Modal, Input, Badge, useToast, Card, Table, TableStrong, FilterChip, Toolbar, RatingChip, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';

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
      toast({ type: 'success', title: editing ? 'Product updated' : 'Product created' });
      setModal(false); load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        sub={`${products.length} listed · The Indian Pet Company`}
        actions={<Button compact leftIcon={<Icon name="plus" size={16} />} onClick={() => { setEditing(null); setForm({ categoryId: categories[0]?.id ?? '', name: '', slug: '', mrp: '', retailPrice: '', tradePrice: '', description: '', isActive: true }); setModal(true); }}>Add product</Button>}
      />
      <div className="p-4 md:p-7">
        <Toolbar>
          <FilterChip active={!catFilter} onClick={() => setCatFilter('')}>All</FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.id} active={catFilter === c.id} onClick={() => setCatFilter(c.id)}>{c.name}</FilterChip>
          ))}
        </Toolbar>

        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              loading={loading}
              emptyMessage="No products found"
              columns={[
                { key: 'name', header: 'Product', render: (p: any) => <TableStrong>{p.name}</TableStrong> },
                { key: 'category', header: 'Category', render: (p: any) => p.category?.name ?? '—' },
                { key: 'mrp', header: 'MRP', align: 'right', render: (p: any) => <span className="line-through text-[#9A8878]">₹{p.mrp}</span> },
                { key: 'retail', header: 'Retail', align: 'right', render: (p: any) => <TableStrong>₹{p.retailPrice}</TableStrong> },
                { key: 'trade', header: 'Trade', align: 'right', render: (p: any) => <span className="font-semibold text-[#1F7A4D]">₹{p.tradePrice}</span> },
                { key: 'margin', header: 'Margin', align: 'right', render: (p: any) => <span className="font-semibold text-[#1F7A4D]">{Math.round((1 - p.tradePrice / p.retailPrice) * 100)}%</span> },
                { key: 'rating', header: 'Rating', render: (p: any) => <RatingChip value={Number(p.rating).toFixed(1)} /> },
                { key: 'status', header: 'Status', render: (p: any) => <Badge variant={p.isActive ? 'ok' : 'muted'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
                { key: 'edit', header: '', align: 'right', render: (p: any) => (
                  <button onClick={() => { setEditing(p); setForm({ ...p, mrp: String(p.mrp), retailPrice: String(p.retailPrice), tradePrice: String(p.tradePrice) }); setModal(true); }}
                    className="p-2 rounded-lg hover:bg-[#F4EDE5] text-[#4A1E0B]" aria-label="Edit product"><Icon name="edit" size={14} /></button>
                ) },
              ]}
              data={products}
              keyExtractor={(p: any) => p.id}
            />
          </div>
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit product' : 'New product'} size="lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancel</Button><Button onClick={handleSave as any} loading={saving}>Save</Button></>}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name *" value={form.name ?? ''} onChange={(e) => up('name', e.target.value)} required />
            <Input label="Slug *" value={form.slug ?? ''} onChange={(e) => up('slug', e.target.value)} required hint="URL-friendly unique key" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#4A3A2C]">Category *</label>
            <select className="mt-1 w-full border border-[#E2D5C6] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
              value={form.categoryId ?? ''} onChange={(e) => up('categoryId', e.target.value)} aria-label="Category">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="MRP (₹) *" type="number" value={form.mrp ?? ''} onChange={(e) => up('mrp', e.target.value)} required />
            <Input label="Retail price (₹) *" type="number" value={form.retailPrice ?? ''} onChange={(e) => up('retailPrice', e.target.value)} required />
            <Input label="Trade price (₹) *" type="number" value={form.tradePrice ?? ''} onChange={(e) => up('tradePrice', e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-[#4A3A2C]">Description</label>
            <textarea className="mt-1 w-full border border-[#E2D5C6] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] resize-none"
              rows={3} value={form.description ?? ''} onChange={(e) => up('description', e.target.value)} aria-label="Product description" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive ?? true} onChange={(e) => up('isActive', e.target.checked)} className="w-4 h-4 accent-[#4A1E0B]" />
            <label htmlFor="isActive" className="text-sm font-medium text-[#4A3A2C]">Active (visible in store)</label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
