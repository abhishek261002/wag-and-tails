import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, KpiCard, Card, CardHeader, CardTitle, Table, TableId, Badge, bookingStatusVariant, Button, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      wagApi.client.get<any>(`/staff/customers/${id}`),
      wagApi.client.get<any>(`/bookings?customerId=${id}&pageSize=50`),
    ])
      .then(([c, b]) => { setCustomer(c); setBookings(b?.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20 text-[#9A8878]">Loading…</div>;
  if (!customer) return <div className="flex justify-center py-20 text-[#9A8878]">Customer not found</div>;

  const name = customer.profile ? `${customer.profile.firstName} ${customer.profile.lastName}` : 'Customer';
  const totalSpend = bookings.filter((b) => b.status === 'completed').reduce((s, b) => s + Number(b.total ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={name}
        sub={`${customer.phone}${customer.addresses?.[0]?.area ? ' · ' + customer.addresses[0].area : ''}`}
        actions={
          <>
            <Button compact leftIcon={<Icon name="plus" size={15} />} onClick={() => navigate('/bookings/new')}>Book for them</Button>
            <Button compact variant="ghost" onClick={() => navigate('/customers')}>Back</Button>
          </>
        }
      />
      <div className="p-4 md:p-7 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Bookings" value={customer._count?.bookings ?? bookings.length} />
          <KpiCard title="Lifetime value" value={`₹${totalSpend.toLocaleString('en-IN')}`} />
          <KpiCard title="Pets" value={customer.pets?.length ?? 0} />
          <KpiCard title="Customer since" value={format(new Date(customer.createdAt), 'MMM yyyy')} />
        </div>

        <Card>
          <CardHeader><CardTitle>Booking history</CardTitle></CardHeader>
          <Table
            bare
            emptyMessage="No bookings yet"
            columns={[
              { key: 'id', header: 'Booking', render: (b: any) => <TableId>{b.id.slice(0, 8)}</TableId> },
              { key: 'svc', header: 'Service', render: (b: any) => (b.type === 'grooming' ? b.packageName ?? 'Grooming' : `${b.durationMinutes}min walk`) },
              { key: 'when', header: 'When', render: (b: any) => (b.scheduledAt ? format(new Date(b.scheduledAt), 'd MMM, h:mm a') : '—') },
              { key: 'partner', header: 'Partner', render: (b: any) => (b.partner?.user?.profile ? `${b.partner.user.profile.firstName} ${b.partner.user.profile.lastName}` : '—') },
              { key: 'total', header: 'Total', align: 'right', render: (b: any) => `₹${b.total}` },
              { key: 'status', header: 'Status', render: (b: any) => <Badge variant={bookingStatusVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge> },
            ]}
            data={bookings}
            keyExtractor={(b: any) => b.id}
            onRowClick={(b: any) => navigate(`/bookings/${b.id}`)}
          />
        </Card>

        {customer.pets?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Pets</CardTitle></CardHeader>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {customer.pets.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full bg-[#F0E2D4] shrink-0 grid place-items-center font-bold text-[#4A1E0B]">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-[#9A8878] truncate">{p.breed}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
