import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Button, Badge, bookingStatusVariant, useToast, Card, CardHeader, CardTitle, Kv, Icon, Tile, RatingChip, Banner } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [booking, setBooking] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [b, hist] = await Promise.all([
        wagApi.bookings.get(id),
        wagApi.bookings.getHistory(id),
      ]);
      setBooking(b);
      setHistory(hist);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    wagApi.client.get<any>('/staff/partners?status=approved').then((res: any) => {
      setPartners(res.data ?? []);
    }).catch(() => {});
  }, []);

  const handleAssign = async () => {
    if (!selectedPartner || !id) return;
    setAssigning(true);
    try {
      await wagApi.client.patch(`/staff/bookings/${id}/assign`, { partnerId: selectedPartner });
      toast({ type: 'success', title: 'Partner assigned' });
      setSelectedPartner('');
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Assignment failed', message: err?.message });
    } finally { setAssigning(false); }
  };

  const handleUnassign = async () => {
    if (!id) return;
    try {
      await wagApi.client.patch(`/staff/bookings/${id}/unassign`);
      toast({ type: 'success', title: 'Partner unassigned' });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    }
  };

  const handleCancel = async () => {
    if (!id || !window.confirm('Cancel this booking?')) return;
    setCancelling(true);
    try {
      await wagApi.bookings.cancel(id, 'Cancelled by staff');
      toast({ type: 'success', title: 'Booking cancelled' });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed', message: err?.message });
    } finally { setCancelling(false); }
  };

  const copyConfirmation = () => {
    if (!booking) return;
    const text = [
      `Booking Confirmation — Wag & Tails`,
      `Service: ${booking.type === 'grooming' ? `Grooming (${booking.packageName})` : `Dog Walk (${booking.durationMinutes} min)`}`,
      `Pet: ${booking.petName}`,
      booking.scheduledAt ? `Date & Time: ${format(new Date(booking.scheduledAt), 'EEEE, d MMM yyyy · h:mm a')}` : '',
      `Address: ${booking.addressLine}`,
      `Total: ₹${booking.total}`,
      `Booking ID: #${booking.id.slice(-8).toUpperCase()}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    toast({ type: 'success', title: 'Confirmation copied', message: 'Paste and send to the customer' });
  };

  if (!booking) {
    return <div className="flex justify-center py-20 text-[#9A8878]">Loading booking…</div>;
  }

  const b = booking;
  const customerName = b.customer?.profile ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}` : 'Customer';
  const partnerName = b.partner?.user?.profile ? `${b.partner.user.profile.firstName} ${b.partner.user.profile.lastName}` : null;
  const serviceLabel = b.type === 'grooming' ? (b.packageName ?? 'Grooming') : `${b.durationMinutes} min walk`;
  const canModify = !['completed', 'cancelled', 'refunded'].includes(b.status);

  return (
    <div>
      <PageHeader
        title={`Booking #${b.id.slice(-8).toUpperCase()}`}
        sub={`${serviceLabel} · ${b.scheduledAt ? format(new Date(b.scheduledAt), 'EEE, d MMM · h:mm a') : '—'}`}
        actions={<Button compact variant="ghost" onClick={() => navigate('/bookings')}>Back</Button>}
      />

      <div className="p-4 md:p-7 grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <Badge variant={bookingStatusVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
            </CardHeader>
            <Kv k="Customer" v={customerName} />
            <Kv k="Phone" v={b.customer?.phone ?? '—'} />
            <Kv k="Pet" v={`${b.petName}${b.petBreed ? ' · ' + b.petBreed : ''}`} />
            <Kv k="Service" v={serviceLabel} />
            <Kv k="Address" v={<span className="max-w-[280px] inline-block text-right">{b.addressLine}</span>} />
            <Kv k="Channel" v={b.channel?.replace(/_/g, ' ') ?? 'app'} />
            <Kv k="Total" v={<span className="font-extrabold text-[15px]">₹{b.total}</span>} />
            {(b.petCareNotes || b.pet?.allergies) && (
              <div className="flex flex-col gap-2 mt-3">
                {b.petCareNotes && <Banner tone="accent" icon="alert" title="Care note" body={b.petCareNotes} />}
                {b.pet?.allergies && <Banner tone="warn" icon="alert" title="Allergies" body={b.pet.allergies} />}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>Partner</CardTitle></CardHeader>
            {partnerName ? (
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-[#F07B2C] shrink-0 grid place-items-center font-bold text-white">
                  {partnerName.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px]">{partnerName}</div>
                  <div className="text-xs text-[#9A8878] mt-0.5">Assigned · will see the care notes in the partner app</div>
                </div>
                {canModify && <Button compact variant="ghost" onClick={handleUnassign}>Reassign</Button>}
              </div>
            ) : (
              <>
                <Banner tone="warn" icon="alert" title="No partner assigned" body="Assign one now so the job doesn't sit idle." />
                <div className="flex flex-col gap-2 mt-3">
                  {partners.slice(0, 5).map((p: any) => (
                    <Tile key={p.userId} selected={selectedPartner === p.userId} onClick={() => setSelectedPartner(p.userId)}>
                      <span className="w-10 h-10 rounded-full bg-[#1F7A4D] shrink-0 grid place-items-center font-bold text-white">
                        {(p.user?.profile?.firstName ?? '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0 text-left">
                        <span className="block font-bold text-[15px] truncate">{p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : '—'}</span>
                        <span className="block text-xs text-[#9A8878] mt-0.5">{(p.modes ?? []).join(', ')} · {p.city ?? '—'}</span>
                      </span>
                      <RatingChip value={Number(p.rating).toFixed(1)} />
                    </Tile>
                  ))}
                </div>
                <Button className="mt-3" fullWidth onClick={handleAssign} loading={assigning} disabled={!selectedPartner}>
                  Assign selected partner
                </Button>
              </>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <div className="flex flex-col gap-2">
              <Button compact variant="ghost" className="!justify-start" leftIcon={<Icon name="doc" size={15} />} onClick={copyConfirmation}>
                Copy confirmation
              </Button>
              {b.customer?.phone && (
                <a href={`tel:${b.customer.phone}`} className="w-full inline-flex items-center gap-[7px] px-[14px] py-[9px] rounded-[9px] text-[13px] font-semibold bg-white border border-[#E2D5C6] text-[#1C1006] hover:bg-[#F4EDE5] transition-colors">
                  <Icon name="phone" size={15} /> Call customer
                </a>
              )}
              {canModify && (
                <Button compact variant="danger" className="!justify-start" leftIcon={<Icon name="close" size={15} />} onClick={handleCancel} loading={cancelling}>
                  Cancel booking
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <div className="relative pl-7">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-[#EDE4D9]" />
              {history.map((h, i) => (
                <div key={h.id} className="relative pb-5 last:pb-0">
                  <span className={`absolute -left-[22px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#FBF7F2] ${i === history.length - 1 ? 'bg-[#E86A1C]' : 'bg-[#1F7A4D]'}`} />
                  <div className="text-sm font-semibold capitalize">{h.status.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-[#9A8878] mt-0.5">{h.note ? h.note + ' · ' : ''}{format(new Date(h.changedAt), 'd MMM · h:mm a')}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
