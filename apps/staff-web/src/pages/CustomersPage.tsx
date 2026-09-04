import React, { useEffect, useState, useCallback } from 'react';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';
import { Search } from 'lucide-react';

export default function CustomersPage() {
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A0A03]">Customers</h2>
          <p className="text-sm text-[#9E7B6A] mt-0.5">{total} total</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E7B6A]" />
        <input
          className="w-full max-w-sm pl-9 pr-4 py-2.5 border border-[#E8D8CC] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] text-[#1A0A03]"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search customers"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>
              {['Name', 'Phone', 'Email', 'Pets', 'Bookings', 'Joined'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E]" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div></td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-[#9E7B6A]">No customers found</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-[#F5EDE3] last:border-0 hover:bg-[#FBF7F2]">
                  <td className="px-4 py-3 font-semibold">
                    {c.profile ? `${c.profile.firstName} ${c.profile.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{c.phone}</td>
                  <td className="px-4 py-3 text-[#9E7B6A]">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-center">{c._count?.pets ?? '—'}</td>
                  <td className="px-4 py-3 text-center">{c._count?.bookings ?? '—'}</td>
                  <td className="px-4 py-3 text-[#9E7B6A]">
                    {format(new Date(c.createdAt), 'd MMM yyyy')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
