import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Button, Badge, bookingStatusVariant, FilterChip, Toolbar, Card, Table, TableId, TableStrong, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'needs_partner', label: 'Needs partner' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'walking', label: 'Dog walking' },
];

export default function BookingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wagApi.bookings.list({
        status: status || undefined,
        type: (type as any) || undefined,
        page,
        pageSize: 25,
      }) as any;
      setBookings(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {}
    finally { setLoading(false); }
  }, [status, type, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Bookings"
        sub={`${total} total`}
        actions={
          <Button compact leftIcon={<Icon name="plus" size={16} />} onClick={() => navigate('/bookings/new')}>
            New booking
          </Button>
        }
      />
      <div className="p-4 md:p-7">
        <Toolbar>
          {STATUS_OPTIONS.map((o) => (
            <FilterChip key={o.value} active={status === o.value} onClick={() => setFilter('status', o.value)}>
              {o.label}
            </FilterChip>
          ))}
          <div className="flex-1" />
          <div className="flex gap-1 bg-white border border-[#E2D5C6] rounded-lg p-1">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setFilter('type', o.value)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${type === o.value ? 'bg-[#4A1E0B] text-white' : 'text-[#4A3A2C] hover:bg-[#F4EDE5]'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Toolbar>

        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              loading={loading}
              emptyMessage="No bookings found"
              columns={[
                { key: 'id', header: 'Booking', render: (b: any) => <TableId>{b.id.slice(0, 8)}</TableId> },
                { key: 'pet', header: 'Pet', render: (b: any) => (
                  <div>
                    <TableStrong>{b.petName}</TableStrong>
                    <div className="text-xs text-[#9A8878]">{b.petBreed}</div>
                  </div>
                ) },
                { key: 'type', header: 'Service', render: (b: any) => (b.type === 'grooming' ? b.packageName ?? 'Grooming' : `${b.durationMinutes}min walk`) },
                { key: 'customer', header: 'Customer', render: (b: any) => (
                  <div>
                    <div>{b.customer?.profile ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}` : '—'}</div>
                    <div className="text-xs text-[#9A8878]">{b.customer?.phone}</div>
                  </div>
                ) },
                { key: 'partner', header: 'Partner', render: (b: any) => (
                  b.partner?.user?.profile
                    ? `${b.partner.user.profile.firstName} ${b.partner.user.profile.lastName}`
                    : <span className="text-[#B3261E] font-semibold">Unassigned</span>
                ) },
                { key: 'when', header: 'When', render: (b: any) => (b.scheduledAt ? format(new Date(b.scheduledAt), 'd MMM, h:mm a') : '—') },
                { key: 'status', header: 'Status', render: (b: any) => <Badge variant={bookingStatusVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge> },
                { key: 'total', header: 'Total', align: 'right', render: (b: any) => <TableStrong>₹{b.total}</TableStrong> },
              ]}
              data={bookings}
              keyExtractor={(b: any) => b.id}
              onRowClick={(b: any) => navigate(`/bookings/${b.id}`)}
            />
          </div>
        </Card>

        {total > 25 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button compact variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="flex items-center text-sm text-[#6E5B4B]">Page {page} of {Math.ceil(total / 25)}</span>
            <Button compact variant="ghost" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
