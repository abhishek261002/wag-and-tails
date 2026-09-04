import React, { useEffect, useState, useCallback } from 'react';
import { Badge, bookingStatusVariant, useToast, Button } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';
import { RefreshCw, Package, Phone, Printer } from 'lucide-react';

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [packingId, setPackingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wagApi.client.get<any>(`/staff/orders?status=${status}&pageSize=50`) as any;
      setOrders(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {} finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const handlePack = async (orderId: string) => {
    setPackingId(orderId);
    try {
      await wagApi.client.patch(`/staff/orders/${orderId}/pack`);
      toast({ type: 'success', title: 'Order marked as packed 📦' });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setPackingId(null); }
  };

  const printLabel = (order: any) => {
    // Open label in new window for printing
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Order Label</title>
      <style>body{font-family:sans-serif;padding:20px;}h2{margin:0;}table{width:100%;border-collapse:collapse;margin-top:12px;}td{padding:6px;border:1px solid #ccc;font-size:13px;}</style>
      </head><body>
      <h2>Wag & Tails 🐾</h2>
      <p>Order: <strong>#${order.orderNumber}</strong></p>
      <table>
        <tr><td><strong>Ship To</strong></td><td>${order.customerName}<br/>${order.customerPhone}<br/>${order.addressLine}</td></tr>
        <tr><td><strong>Items</strong></td><td>${order.items?.map((i: any) => `${i.productName} x${i.quantity}`).join('<br/>') ?? ''}</td></tr>
        <tr><td><strong>Total</strong></td><td>₹${order.total}</td></tr>
        <tr><td><strong>Date</strong></td><td>${format(new Date(order.createdAt), 'd MMM yyyy')}</td></tr>
      </table>
      <script>window.print();</script>
      </body></html>
    `);
  };

  const orderStatusVariant = (s: string) => {
    const m: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      placed: 'info', packed: 'success', out_for_delivery: 'marigold' as any,
      delivered: 'success', cancelled: 'error', refunded: 'warning',
    };
    return m[s] ?? 'default';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A0A03]">Store Orders</h2>
          <p className="text-sm text-[#9E7B6A] mt-0.5">{total} total</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} leftIcon={<RefreshCw size={14} />}>Refresh</Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 bg-white border border-[#E8D8CC] rounded-xl p-1 w-fit">
        {[{ v: '', l: 'All' }, { v: 'placed', l: 'Placed' }, { v: 'packed', l: 'Packed' }, { v: 'out_for_delivery', l: 'Shipping' }, { v: 'delivered', l: 'Delivered' }].map(({ v, l }) => (
          <button
            key={v}
            onClick={() => setStatus(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${status === v ? 'bg-[#4A1E0B] text-white' : 'text-[#5C3D2E] hover:bg-[#FBF7F2]'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E8D8CC] overflow-hidden">
        <table className="w-full text-sm" role="grid">
          <thead className="bg-[#FBF7F2] border-b border-[#E8D8CC]">
            <tr>
              {['Order #', 'Customer', 'Items', 'Total', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-[#5C3D2E] whitespace-nowrap" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" /></div></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#9E7B6A]">No orders found</td></tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-[#F5EDE3] last:border-0">
                  <td className="px-4 py-3 font-bold text-[#4A1E0B]">#{o.orderNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{o.customerName}</div>
                    <div className="text-xs text-[#9E7B6A]">{o.customerPhone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      {o.items?.slice(0, 2).map((i: any) => (
                        <div key={i.id}>{i.productName} ×{i.quantity}</div>
                      ))}
                      {o.items?.length > 2 && <div className="text-[#9E7B6A]">+{o.items.length - 2} more</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#4A1E0B]">₹{o.total}</td>
                  <td className="px-4 py-3">
                    <Badge variant={orderStatusVariant(o.status) as any}>{o.status.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[#9E7B6A] whitespace-nowrap">
                    {format(new Date(o.createdAt), 'd MMM, h:mm a')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {o.customer?.phone && (
                        <a
                          href={`tel:${o.customerPhone}`}
                          className="p-1.5 rounded-lg bg-[#FBF7F2] hover:bg-[#EDD9C4] text-[#4A1E0B] transition-colors"
                          title="Call customer"
                        >
                          <Phone size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => printLabel(o)}
                        className="p-1.5 rounded-lg bg-[#FBF7F2] hover:bg-[#EDD9C4] text-[#4A1E0B] transition-colors"
                        title="Print label"
                        aria-label="Print order label"
                      >
                        <Printer size={14} />
                      </button>
                      {o.status === 'placed' && (
                        <button
                          onClick={() => handlePack(o.id)}
                          disabled={packingId === o.id}
                          className="px-2 py-1 rounded-lg bg-[#4A1E0B] text-white text-xs font-bold hover:bg-[#5E2A11] disabled:opacity-50 transition-colors"
                          aria-label="Mark as packed"
                        >
                          {packingId === o.id ? '...' : <Package size={13} />}
                        </button>
                      )}
                    </div>
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
