import React, { useState } from 'react';
import { Button, Modal, Input, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { Plus } from 'lucide-react';

export default function StaffPage() {
  const { toast } = useToast();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'staff' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await wagApi.client.post('/admin/staff', form);
      toast({ type: 'success', title: 'Staff account created', message: 'Default password: ChangeMe123! — remind them to change it.' });
      setModal(false);
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[#1A0A03]">Staff Users</h2>
        <Button onClick={() => setModal(true)} leftIcon={<Plus size={14} />}>Add Staff</Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
        <p className="font-bold mb-1">⚠️ Security reminder</p>
        <p>New staff accounts are created with the default password <code className="font-mono bg-amber-100 px-1 rounded">ChangeMe123!</code>. Notify the staff member to change it immediately after first login.</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] p-8 text-center text-[#9E7B6A]">
        <p className="text-3xl mb-3">👥</p>
        <p className="font-semibold">Staff user management</p>
        <p className="text-sm mt-1">Use the button above to create staff accounts. Staff can log into the Staff Portal at <span className="font-mono text-[#4A1E0B]">localhost:3003</span></p>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Staff User"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancel</Button><Button onClick={handleCreate as any} loading={saving}>Create Account</Button></>}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Email address *" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="newstaff@wagandtails.in" required />
          <div>
            <label className="text-sm font-medium text-[#5C3D2E]">Role</label>
            <select className="mt-1 w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
              value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} aria-label="Staff role">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <p className="text-xs text-[#9E7B6A]">A temporary password <code>ChangeMe123!</code> will be assigned. The staff member must change it at first login.</p>
        </form>
      </Modal>
    </div>
  );
}
