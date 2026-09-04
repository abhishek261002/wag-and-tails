import React, { useEffect, useState } from 'react';
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
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-[#1A0A03]">Audit Log</h2>
        <p className="text-sm text-[#9E7B6A]">{total} total entries — all admin and staff actions</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>{['Time', 'User', 'Role', 'Action', 'Entity', 'Entity ID'].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap" scope="col">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div></td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-[#9E7B6A]">No audit log entries yet</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3 text-xs text-[#9E7B6A] whitespace-nowrap">{format(new Date(l.createdAt), 'd MMM, h:mm:ss a')}</td>
                  <td className="px-4 py-3 text-xs">{l.userEmail ?? l.userId?.slice(0, 8)}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${l.userRole === 'admin' ? 'bg-[#FEF3EA] text-[#C25A12]' : 'bg-[#E3F2FD] text-[#1565C0]'}`}>{l.userRole}</span></td>
                  <td className="px-4 py-3 font-semibold text-xs capitalize">{l.action.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-xs capitalize text-[#5C3D2E]">{l.entity}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#9E7B6A]">{l.entityId ? l.entityId.slice(-8).toUpperCase() : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 rounded-xl border border-[#E8D8CC] text-sm font-semibold disabled:opacity-40">← Prev</button>
          <span className="flex items-center text-sm text-[#9E7B6A]">Page {page}</span>
          <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-xl border border-[#E8D8CC] text-sm font-semibold disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
