import React, { useEffect, useState } from 'react';
import { PageHeader, Button, Modal, Input, Badge, useToast, Card, CardHeader, CardTitle, Table, TableStrong, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';

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
      toast({ type: 'success', title: editing ? 'Package updated' : 'Package created' });
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
      toast({ type: 'success', title: 'Walk price updated' });
      setModal(null); load();
    } catch (err: any) { toast({ type: 'error', title: 'Failed', message: err?.message }); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader
        title="Grooming packages"
        sub="What customers can book"
        actions={<Button compact leftIcon={<Icon name="plus" size={16} />} onClick={() => { setEditing(null); setForm({ name: '', mrp: '', price: '', description: '', inclusions: '' }); setModal('package'); }}>Add package</Button>}
      />
      <div className="p-4 md:p-7 space-y-4">
        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              emptyMessage="No packages yet"
              columns={[
                { key: 'name', header: 'Package', render: (p: any) => (
                  <div>
                    <TableStrong>{p.name}</TableStrong>
                    <div className="text-xs text-[#9A8878] mt-0.5">{p.description}</div>
                  </div>
                ) },
                { key: 'services', header: 'Services', align: 'center', render: (p: any) => (p.inclusions ?? []).length },
                { key: 'mrp', header: 'MRP', align: 'right', render: (p: any) => `₹${p.mrp}` },
                { key: 'price', header: 'Price', align: 'right', render: (p: any) => <TableStrong>₹{p.price}</TableStrong> },
                { key: 'status', header: 'Status', render: (p: any) => <Badge variant={p.isActive ? 'ok' : 'muted'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
                { key: 'edit', header: '', align: 'right', render: (p: any) => (
                  <button onClick={() => { setEditing(p); setForm({ ...p }); setModal('package'); }} className="p-2 rounded-lg hover:bg-[#F4EDE5] text-[#4A1E0B]" aria-label="Edit package"><Icon name="edit" size={14} /></button>
                ) },
              ]}
              data={packages}
              keyExtractor={(p: any) => p.id}
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add-ons</CardTitle>
              <Button compact variant="ghost" leftIcon={<Icon name="plus" size={14} />} onClick={() => { setEditing(null); setForm({ name: '', price: '', description: '' }); setModal('addon'); }}>Add</Button>
            </CardHeader>
            <Table
              bare
              emptyMessage="No add-ons yet"
              columns={[
                { key: 'name', header: 'Add-on', render: (a: any) => (
                  <div>
                    <TableStrong>{a.name}</TableStrong>
                    <div className="text-xs text-[#9A8878] mt-0.5">{a.description ?? ''}</div>
                  </div>
                ) },
                { key: 'price', header: 'Price', align: 'right', render: (a: any) => `₹${a.price}` },
                { key: 'status', header: 'Status', render: (a: any) => <Badge variant={a.isActive ? 'ok' : 'muted'}>{a.isActive ? 'Active' : 'Inactive'}</Badge> },
                { key: 'edit', header: '', align: 'right', render: (a: any) => (
                  <button onClick={() => { setEditing(a); setForm({ ...a, price: String(a.price) }); setModal('addon'); }} className="p-2 rounded-lg hover:bg-[#F4EDE5] text-[#4A1E0B]" aria-label="Edit add-on"><Icon name="edit" size={14} /></button>
                ) },
              ]}
              data={addOns}
              keyExtractor={(a: any) => a.id}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Walk pricing</CardTitle>
              <Badge variant="warn">Provisional</Badge>
            </CardHeader>
            <Table
              bare
              emptyMessage="No walk pricing configured"
              columns={[
                { key: 'duration', header: 'Duration', render: (w: any) => <TableStrong>{w.durationMinutes} minutes</TableStrong> },
                { key: 'price', header: 'Price', align: 'right', render: (w: any) => `₹${w.price}` },
                { key: 'edit', header: '', align: 'right', render: (w: any) => (
                  <button onClick={() => { setEditing(w); setForm({ price: String(w.price) }); setModal('walk'); }} className="p-2 rounded-lg hover:bg-[#F4EDE5] text-[#4A1E0B]" aria-label="Edit walk price"><Icon name="edit" size={14} /></button>
                ) },
              ]}
              data={walkPricing}
              keyExtractor={(w: any) => w.id}
            />
            <div className="flex items-start gap-3 rounded-[18px] p-3.5 bg-[#FFF1E4] mt-3">
              <span className="shrink-0 mt-px text-[#B4520F]"><Icon name="alert" size={17} /></span>
              <div className="text-xs text-[#6E5B4B]">Walk prices are placeholders pending a route and payout study.</div>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={modal === 'package'} onClose={() => setModal(null)} title={editing ? 'Edit package' : 'New package'}
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
              <label className="text-sm font-medium text-[#4A3A2C]">Inclusions (one per line)</label>
              <textarea className="mt-1 w-full border border-[#E2D5C6] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] resize-none"
                rows={5} value={form.inclusions ?? ''} onChange={(e) => up('inclusions', e.target.value)} placeholder="Bath with shampoo&#10;Blow dry&#10;Nail trim" aria-label="Package inclusions" />
            </div>
          )}
        </form>
      </Modal>

      <Modal open={modal === 'addon'} onClose={() => setModal(null)} title={editing ? 'Edit add-on' : 'New add-on'}
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveAddon as any} loading={saving}>Save</Button></>}>
        <form onSubmit={saveAddon} className="space-y-4">
          <Input label="Name *" value={form.name ?? ''} onChange={(e) => up('name', e.target.value)} required />
          <Input label="Price (₹) *" type="number" value={form.price ?? ''} onChange={(e) => up('price', e.target.value)} required />
          <Input label="Description" value={form.description ?? ''} onChange={(e) => up('description', e.target.value)} />
        </form>
      </Modal>

      <Modal open={modal === 'walk'} onClose={() => setModal(null)} title={`Edit ${editing?.durationMinutes}min walk price`}
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveWalkPrice as any} loading={saving}>Update</Button></>}>
        <form onSubmit={saveWalkPrice} className="space-y-4">
          <Input label="Price (₹) *" type="number" value={form.price ?? ''} onChange={(e) => up('price', e.target.value)} required />
        </form>
      </Modal>
    </div>
  );
}
