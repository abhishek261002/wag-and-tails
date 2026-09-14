import React, { useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardTitle, Table, TableStrong, Badge, FilterChip } from '@wag/ui-web';
import { wagApi } from '../lib/api';

const SLOTS = ['9:00 am', '10:30 am', '12:00 pm', '1:30 pm', '3:00 pm', '4:30 pm', '6:00 pm', '7:30 pm'];

export default function AreasPage() {
  const [areas, setAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wagApi.client.get<any[]>('/admin/areas').then((r: any) => setAreas(r ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Service areas" sub="Where Wag & Tails operates" />
      <div className="p-4 md:p-7 grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle>Coverage</CardTitle></CardHeader>
          <Table
            bare
            loading={loading}
            emptyMessage="No active service cities yet — approve a partner to see coverage here"
            columns={[
              { key: 'city', header: 'City', render: (a: any) => <TableStrong>{a.city}</TableStrong> },
              { key: 'groomers', header: 'Groomers', render: (a: any) => a.groomers || <span className="text-[#B3261E] font-semibold">0</span> },
              { key: 'walkers', header: 'Walkers', render: (a: any) => a.walkers || <span className="text-[#B3261E] font-semibold">0</span> },
              { key: 'status', header: 'Status', render: (a: any) => <Badge variant={a.status === 'Active' ? 'ok' : 'warn'}>{a.status}</Badge> },
            ]}
            data={areas}
            keyExtractor={(a: any) => a.city}
          />
        </Card>

        <Card>
          <CardHeader><CardTitle>Booking slots</CardTitle></CardHeader>
          <p className="text-sm text-[#6E5B4B] mb-3">Slots offered to customers, per day.</p>
          <div className="flex flex-wrap gap-2">
            {SLOTS.map((s) => <FilterChip key={s} active>{s}</FilterChip>)}
          </div>
          <div className="h-px bg-[#EDE4D9] my-4" />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm">Same-day booking cut-off</span>
            <span className="text-sm font-semibold">2 hours before</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm">Free cancellation window</span>
            <span className="text-sm font-semibold">4 hours</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm">Platform commission</span>
            <span className="text-sm font-semibold">20%</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
