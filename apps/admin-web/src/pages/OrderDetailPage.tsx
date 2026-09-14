import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Button, Badge, useToast, Card, CardHeader, CardTitle, Kv, Icon } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

const ORDER_STATUS_TONE: Record<string, any> = {
  placed: 'info', packed: 'accent', out_for_delivery: 'accent', delivered: 'ok', cancelled: 'muted', refunded: 'warn',
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [packing, setPacking] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    wagApi.client.get<any>(`/store/orders/${id}`).then(setOrder).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handlePack = async () => {
    if (!id) return;
    setPacking(true);
    try {
      await wagApi.client.patch(`/store/orders/${id}/pack`);
      toast({ type: 'success', title: 'Marked as packed' });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setPacking(false); }
  };

  const printLabel = () => {
    if (!order) return;
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

  if (loading) return <div className="flex justify-center py-20 text-[#9A8878]">Loading order…</div>;
  if (!order) return <div className="flex justify-center py-20 text-[#9A8878]">Order not found</div>;

  return (
    <div>
      <PageHeader
        title={`Order #${order.orderNumber}`}
        sub={`${order.customerName} · ${format(new Date(order.createdAt), 'd MMM, h:mm a')}`}
        actions={<Button compact variant="ghost" onClick={() => navigate('/orders')}>Back</Button>}
      />
      <div className="p-4 md:p-7 grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <Badge variant={ORDER_STATUS_TONE[order.status] ?? 'muted'}>{order.status.replace(/_/g, ' ')}</Badge>
          </CardHeader>
          <div className="flex flex-col">
            {(order.items ?? []).map((item: any) => (
              <div key={item.id} className="flex gap-3 py-3.5 border-b border-[#EDE4D9] last:border-0">
                <span className="w-[72px] h-[72px] rounded-[12px] bg-[#F4EDE5] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{item.productName}</div>
                  <div className="text-xs text-[#9A8878] mt-1">Qty {item.quantity}</div>
                </div>
                <div className="text-sm font-semibold">₹{item.totalPrice ?? item.price}</div>
              </div>
            ))}
          </div>
          <div className="h-px bg-[#EDE4D9] my-3" />
          <Kv k="Total" v={<span className="text-[17px] font-extrabold">₹{order.total}</span>} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Fulfilment</CardTitle></CardHeader>
            <div className="flex flex-col gap-2">
              {order.status === 'placed' && (
                <Button compact className="!justify-start" leftIcon={<Icon name="bag" size={15} />} onClick={handlePack} loading={packing}>
                  Mark packed
                </Button>
              )}
              <Button compact variant="ghost" className="!justify-start" leftIcon={<Icon name="doc" size={15} />} onClick={printLabel}>
                Print label
              </Button>
              {order.customerPhone && (
                <a href={`tel:${order.customerPhone}`} className="w-full inline-flex items-center gap-[7px] px-[14px] py-[9px] rounded-[9px] text-[13px] font-semibold bg-white border border-[#E2D5C6] text-[#1C1006] hover:bg-[#F4EDE5] transition-colors">
                  <Icon name="phone" size={15} /> Call customer
                </a>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <Kv k="Name" v={order.customerName} />
            <Kv k="Phone" v={order.customerPhone} />
            <Kv k="Channel" v={order.channel} />
            <Kv k="Address" v={<span className="max-w-[220px] inline-block text-right">{order.addressLine}</span>} />
          </Card>
        </div>
      </div>
    </div>
  );
}
