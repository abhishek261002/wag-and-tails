import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Badge, bookingStatusVariant, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { format } from 'date-fns';
import { ArrowLeft, Phone, Copy, UserCheck, Calendar, XCircle } from 'lucide-react';

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

  // Load partners for assignment
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
      toast({ type: 'success', title: 'Partner assigned!' });
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
      ``,
      `For help, call us at +91-XXX-XXX-XXXX`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    toast({ type: 'success', title: 'Confirmation text copied!', message: 'Paste and send to customer' });
  };

  if (!booking) return (
    <div className="flex justify-center py-20 text-[#9E7B6A]">Loading booking...</div>
  );

  const b = booking;
  const customerName = b.customer?.profile ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}` : 'Customer';
  const partnerName = b.partner?.user?.profile ? `${b.partner.user.profile.firstName} ${b.partner.user.profile.lastName}` : null;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bookings')} className="text-[#9E7B6A] hover:text-[#4A1E0B] transition-colors"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-xl font-extrabold text-[#1A0A03]">
            {b.type === 'grooming' ? '✂️ Grooming' : '🐾 Walk'} · {b.petName}
          </h2>
          <p className="text-sm text-[#9E7B6A]">#{b.id.slice(-8).toUpperCase()}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={bookingStatusVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
          <Button variant="outline" size="sm" onClick={copyConfirmation} leftIcon={<Copy size={14} />}>Copy Confirmation</Button>
          {!['completed', 'cancelled', 'refunded'].includes(b.status) && (
            <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelling} leftIcon={<XCircle size={14} />}>Cancel</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pet details — care notes always prominent */}
        <InfoCard title="🐾 Pet Details">
          <InfoRow label="Pet" value={`${b.petName} — ${b.petBreed}`} />
          <InfoRow label="Size" value={b.petSize} />
          {b.pet?.weightKg && <InfoRow label="Weight" value={`${b.pet.weightKg} kg`} />}
          {b.petCareNotes && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-1">📝 Care Notes</p>
              <p className="text-sm text-amber-800">{b.petCareNotes}</p>
            </div>
          )}
          {b.pet?.allergies && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs font-bold text-red-700 mb-1">⚠️ Allergies</p>
              <p className="text-sm text-red-700">{b.pet.allergies}</p>
            </div>
          )}
        </InfoCard>

        {/* Customer */}
        <InfoCard title="👤 Customer">
          <InfoRow label="Name" value={customerName} />
          <InfoRow label="Phone" value={b.customer?.phone ?? '—'} />
          <InfoRow label="Address" value={b.addressLine} />
          {b.notes && <InfoRow label="Note" value={b.notes} />}
          <div className="mt-3 flex gap-2">
            {b.customer?.phone && (
              <a href={`tel:${b.customer.phone}`} className="flex items-center gap-1 text-sm font-semibold text-[#C25A12] hover:underline">
                <Phone size={14} /> Call
              </a>
            )}
          </div>
        </InfoCard>

        {/* Service */}
        <InfoCard title="📋 Service">
          <InfoRow label="Type" value={b.type === 'grooming' ? 'Grooming' : 'Dog Walk'} />
          {b.packageName && <InfoRow label="Package" value={b.packageName} />}
          {b.durationMinutes && <InfoRow label="Duration" value={`${b.durationMinutes} minutes`} />}
          {b.addOns?.length > 0 && <InfoRow label="Add-ons" value={b.addOns.map((a: any) => a.name).join(', ')} />}
          {b.scheduledAt && <InfoRow label="Scheduled" value={format(new Date(b.scheduledAt), 'EEE, d MMM yyyy · h:mm a')} />}
          <InfoRow label="Channel" value={b.channel?.replace(/_/g, ' ') ?? 'app'} />
        </InfoCard>

        {/* Payment */}
        <InfoCard title="💰 Payment">
          <InfoRow label="Subtotal" value={`₹${b.subtotal}`} />
          {Number(b.discount) > 0 && <InfoRow label="Discount" value={`-₹${b.discount}`} />}
          <InfoRow label="Total" value={`₹${b.total}`} bold />
          <InfoRow label="Method" value={b.paymentMethod?.replace(/_/g, ' ') ?? '—'} />
          <InfoRow label="Payment status" value={b.paymentStatus} />
          {b.couponCode && <InfoRow label="Coupon" value={b.couponCode} />}
        </InfoCard>
      </div>

      {/* Partner assignment */}
      <div className="bg-white rounded-2xl border border-[#E8D8CC] p-5">
        <h3 className="font-bold text-[#1A0A03] mb-4 flex items-center gap-2"><UserCheck size={18} /> Partner Assignment</h3>
        {partnerName ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{partnerName}</p>
              <p className="text-sm text-[#9E7B6A]">Currently assigned</p>
            </div>
            {!['completed', 'cancelled', 'in_progress'].includes(b.status) && (
              <div className="flex gap-2">
                <select
                  className="border border-[#E8D8CC] rounded-xl px-3 py-2 text-sm text-[#1A0A03] bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
                  value={selectedPartner}
                  onChange={(e) => setSelectedPartner(e.target.value)}
                  aria-label="Select partner to reassign"
                >
                  <option value="">Reassign to...</option>
                  {partners.map((p: any) => (
                    <option key={p.userId} value={p.userId}>
                      {p.user?.profile?.firstName} {p.user?.profile?.lastName}
                    </option>
                  ))}
                </select>
                {selectedPartner && <Button size="sm" onClick={handleAssign} loading={assigning}>Reassign</Button>}
                <Button size="sm" variant="outline" onClick={handleUnassign}>Unassign</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <select
              className="flex-1 border border-[#E8D8CC] rounded-xl px-3 py-2 text-sm text-[#1A0A03] bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              aria-label="Select partner to assign"
            >
              <option value="">Select a partner...</option>
              {partners.map((p: any) => (
                <option key={p.userId} value={p.userId}>
                  {p.user?.profile?.firstName} {p.user?.profile?.lastName} — ⭐{p.rating}
                </option>
              ))}
            </select>
            <Button onClick={handleAssign} loading={assigning} disabled={!selectedPartner}>Assign</Button>
          </div>
        )}
      </div>

      {/* Status history */}
      <div className="bg-white rounded-2xl border border-[#E8D8CC] p-5">
        <h3 className="font-bold text-[#1A0A03] mb-4 flex items-center gap-2"><Calendar size={18} /> Status History</h3>
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="flex items-start gap-3 py-2 border-b border-[#F5EDE3] last:border-0">
              <div className="w-2 h-2 rounded-full bg-[#F07B2C] mt-2 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold text-sm capitalize">{h.status.replace(/_/g, ' ')}</span>
                {h.note && <span className="text-xs text-[#9E7B6A] ml-2">— {h.note}</span>}
              </div>
              <span className="text-xs text-[#9E7B6A]">
                {format(new Date(h.changedAt), 'd MMM · h:mm a')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8D8CC] p-5">
      <h3 className="font-bold text-[#1A0A03] mb-3 text-sm">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-[#F5EDE3] last:border-0">
      <span className="text-sm text-[#9E7B6A]">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-[#4A1E0B]' : 'font-medium text-[#1A0A03]'} max-w-[55%] text-right`}>{value}</span>
    </div>
  );
}
