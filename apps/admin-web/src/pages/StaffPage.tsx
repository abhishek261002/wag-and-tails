import React, { useEffect, useState } from 'react';
import { PageHeader, Button, Modal, Input, Badge, Card, CardHeader, CardTitle, Table, TableStrong, Icon, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

const PERMISSIONS: [string, boolean, boolean, boolean][] = [
  ['Create and edit bookings', true, false, true],
  ['Reply to support tickets', true, true, true],
  ['Assign partners', true, false, true],
  ['Escalate to admin', true, true, true],
  ['Edit catalogue and pricing', false, false, true],
  ['Release payouts', false, false, true],
  ['Approve partners', false, false, true],
];

export default function StaffPage() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'staff' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    wagApi.client.get<any[]>('/admin/staff').then((r: any) => setStaff(r ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await wagApi.client.post('/admin/staff', form);
      toast({ type: 'success', title: 'Staff account created', message: 'Default password: ChangeMe123! — remind them to change it.' });
      setModal(false);
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        sub={`${staff.length} accounts`}
        actions={<Button compact leftIcon={<Icon name="plus" size={16} />} onClick={() => setModal(true)}>Invite staff</Button>}
      />
      <div className="p-4 md:p-7 space-y-4">
        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              loading={loading}
              emptyMessage="No staff accounts yet"
              columns={[
                { key: 'name', header: 'Name', render: (s: any) => (
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#F0E2D4] shrink-0 grid place-items-center text-xs font-bold text-[#4A1E0B]">
                      {(s.profile?.firstName ?? s.email ?? '?').slice(0, 1).toUpperCase()}
                    </span>
                    <TableStrong>{s.profile ? `${s.profile.firstName} ${s.profile.lastName}` : s.email}</TableStrong>
                  </div>
                ) },
                { key: 'role', header: 'Role', render: (s: any) => <Badge variant={s.role === 'admin' ? 'brand-solid' : 'accent'}>{s.role === 'admin' ? 'Super admin' : 'Bookings staff'}</Badge> },
                { key: 'email', header: 'Email', render: (s: any) => s.email },
                { key: 'status', header: 'Status', render: (s: any) => <Badge variant={s.isActive ? 'ok' : 'muted'}>{s.isActive ? 'Active' : 'Inactive'}</Badge> },
                { key: 'joined', header: 'Joined', render: (s: any) => format(new Date(s.createdAt), 'd MMM yyyy') },
              ]}
              data={staff}
              keyExtractor={(s: any) => s.id}
            />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Permissions</CardTitle></CardHeader>
          <Table
            bare
            columns={[
              { key: 'cap', header: 'Capability', render: (r: any) => <TableStrong>{r[0]}</TableStrong> },
              { key: 'staff', header: 'Bookings staff', align: 'center', render: (r: any) => <PermCheck ok={r[1]} /> },
              { key: 'support', header: 'Support', align: 'center', render: (r: any) => <PermCheck ok={r[2]} /> },
              { key: 'admin', header: 'Super admin', align: 'center', render: (r: any) => <PermCheck ok={r[3]} /> },
            ]}
            data={PERMISSIONS}
            keyExtractor={(r: any) => r[0]}
          />
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Invite staff"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Cancel</Button><Button onClick={handleCreate as any} loading={saving}>Create account</Button></>}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Email address *" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="newstaff@wagandtails.in" required />
          <div>
            <label className="text-sm font-medium text-[#4A3A2C]">Role</label>
            <select className="mt-1 w-full border border-[#E2D5C6] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
              value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} aria-label="Staff role">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <p className="text-xs text-[#9A8878]">A temporary password <code>ChangeMe123!</code> will be assigned. The staff member must change it at first login.</p>
        </form>
      </Modal>
    </div>
  );
}

function PermCheck({ ok }: { ok: boolean }) {
  return ok ? <span className="text-[#1F7A4D] inline-flex"><Icon name="check" size={17} /></span> : <span className="text-[#9A8878] inline-flex"><Icon name="close" size={15} /></span>;
}
