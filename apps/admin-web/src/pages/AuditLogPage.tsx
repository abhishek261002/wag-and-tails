import React, { useEffect, useState } from 'react';
import { PageHeader, Badge, Card, Table, Button } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    wagApi.client.get<any>(`/admin/audit-logs?page=${page}&pageSize=50`)
      .then((r: any) => { setLogs(r.data ?? []); setTotal(r.total ?? 0); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <PageHeader title="Audit log" sub={`${total} entries · every admin and staff action`} />
      <div className="p-4 md:p-7">
        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              loading={loading}
              emptyMessage="No audit log entries yet"
              columns={[
                { key: 'time', header: 'Time', render: (l: any) => <span className="text-xs text-[#6E5B4B] whitespace-nowrap">{format(new Date(l.createdAt), 'd MMM, h:mm:ss a')}</span> },
                { key: 'user', header: 'User', render: (l: any) => l.userEmail ?? l.userId?.slice(0, 8) },
                { key: 'role', header: 'Role', render: (l: any) => <Badge variant={l.userRole === 'admin' ? 'accent' : 'info'}>{l.userRole}</Badge> },
                { key: 'action', header: 'Action', render: (l: any) => <span className="font-semibold capitalize">{l.action.replace(/_/g, ' ')}</span> },
                { key: 'entity', header: 'Entity', render: (l: any) => <span className="capitalize">{l.entity}</span> },
                { key: 'entityId', header: 'Entity ID', render: (l: any) => <span className="font-mono text-xs text-[#9A8878]">{l.entityId ? l.entityId.slice(-8).toUpperCase() : '—'}</span> },
              ]}
              data={logs}
              keyExtractor={(l: any) => l.id}
            />
          </div>
        </Card>

        {total > 50 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button compact variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="flex items-center text-sm text-[#6E5B4B]">Page {page} of {Math.ceil(total / 50)}</span>
            <Button compact variant="ghost" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
