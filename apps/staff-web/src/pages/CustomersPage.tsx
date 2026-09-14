import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Table, TableStrong } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wagApi.client.get<any>(`/staff/customers?search=${encodeURIComponent(search)}&pageSize=50`) as any;
      setCustomers(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <PageHeader title="Customers" sub={`${total} registered`} search onSearchChange={setSearch} searchPlaceholder="Search by name or phone…" />
      <div className="p-4 md:p-7">
        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              loading={loading}
              emptyMessage="No customers found"
              columns={[
                { key: 'name', header: 'Name', render: (c: any) => <TableStrong>{c.profile ? `${c.profile.firstName} ${c.profile.lastName}` : '—'}</TableStrong> },
                { key: 'phone', header: 'Phone', render: (c: any) => c.phone },
                { key: 'email', header: 'Email', render: (c: any) => c.email ?? '—' },
                { key: 'pets', header: 'Pets', align: 'center', render: (c: any) => c._count?.pets ?? '—' },
                { key: 'bookings', header: 'Bookings', align: 'center', render: (c: any) => c._count?.bookings ?? '—' },
                { key: 'since', header: 'Since', render: (c: any) => format(new Date(c.createdAt), 'd MMM yyyy') },
              ]}
              data={customers}
              keyExtractor={(c: any) => c.id}
              onRowClick={(c: any) => navigate(`/customers/${c.id}`)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
