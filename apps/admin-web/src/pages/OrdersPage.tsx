import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Badge, useToast, Button, FilterChip, Toolbar, Card, Table, TableId, TableStrong, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { v: '', l: 'All' },
  { v: 'placed', l: 'Placed' },
  { v: 'packed', l: 'Packed' },
  { v: 'out_for_delivery', l: 'Out for delivery' },
  { v: 'delivered', l: 'Delivered' },
];

const ORDER_STATUS_TONE: Record<string, any> = {
  placed: 'info', packed: 'accent', out_for_delivery: 'accent', delivered: 'ok', cancelled: 'muted', refunded: 'warn',
};

export default function OrdersPage() {
  const navigate = useNavigate();
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
      toast({ type: 'success', title: 'Marked as packed' });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setPackingId(null); }
  };

  const printLabel = (order: any) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Order Label</title>
      <style>body{font-family:sans-serif;padding:20px;}h2{margin:0;}table{width:100%;border-collapse:collapse;margin-top:12px;}td{padding:6px;border:1px solid #ccc;font-size:13px;}</style>
      </head><body>
      <h2>Wag &amp; Tails</h2>
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

  return (
    <div>
      <PageHeader
        title="Store orders"
        sub="The Indian Pet Company"
        actions={<Button compact variant="ghost" leftIcon={<Icon name="refresh" size={15} />} onClick={load}>Refresh</Button>}
      />
      <div className="p-4 md:p-7">
        <Toolbar>
          {STATUS_OPTIONS.map((o) => (
            <FilterChip key={o.v} active={status === o.v} onClick={() => setStatus(o.v)}>{o.l}</FilterChip>
          ))}
        </Toolbar>

        <Card padding="none">
          <div className="p-[18px]">
            <Table
              bare
              loading={loading}
              emptyMessage="No orders found"
              columns={[
                { key: 'id', header: 'Order', render: (o: any) => <TableId>#{o.orderNumber}</TableId> },
                { key: 'customer', header: 'Customer', render: (o: any) => (
                  <div>
                    <TableStrong>{o.customerName}</TableStrong>
                    <div className="text-xs text-[#9A8878]">{o.customerPhone}</div>
                  </div>
                ) },
                { key: 'items', header: 'Items', render: (o: any) => (
                  <div className="text-xs">
                    {o.items?.slice(0, 2).map((i: any) => <div key={i.id}>{i.productName} ×{i.quantity}</div>)}
                    {o.items?.length > 2 && <div className="text-[#9A8878]">+{o.items.length - 2} more</div>}
                  </div>
                ) },
                { key: 'total', header: 'Total', align: 'right', render: (o: any) => <TableStrong>₹{o.total}</TableStrong> },
                { key: 'status', header: 'Status', render: (o: any) => <Badge variant={ORDER_STATUS_TONE[o.status] ?? 'muted'}>{o.status.replace(/_/g, ' ')}</Badge> },
                { key: 'when', header: 'Placed', render: (o: any) => format(new Date(o.createdAt), 'd MMM, h:mm a') },
                { key: 'actions', header: '', align: 'right', render: (o: any) => (
                  <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                    {o.customerPhone && (
                      <a href={`tel:${o.customerPhone}`} className="p-2 rounded-lg bg-[#F4EDE5] hover:bg-[#F0E2D4] text-[#4A1E0B] transition-colors" title="Call customer">
                        <Icon name="phone" size={14} />
                      </a>
                    )}
                    <button onClick={() => printLabel(o)} className="p-2 rounded-lg bg-[#F4EDE5] hover:bg-[#F0E2D4] text-[#4A1E0B] transition-colors" title="Print label" aria-label="Print order label">
                      <Icon name="doc" size={14} />
                    </button>
                    {o.status === 'placed' && (
                      <Button compact loading={packingId === o.id} onClick={() => handlePack(o.id)}>Mark packed</Button>
                    )}
                  </div>
                ) },
              ]}
              data={orders}
              keyExtractor={(o: any) => o.id}
              onRowClick={(o: any) => navigate(`/orders/${o.id}`)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
