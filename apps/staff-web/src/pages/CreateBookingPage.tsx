import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { ArrowLeft } from 'lucide-react';

const CHANNELS = ['app', 'whatsapp', 'phone_call', 'instagram', 'walk_in', 'other'];

export default function CreateBookingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState({
    customerPhone: '',
    customerId: '',
    petId: '',
    type: 'grooming' as 'grooming' | 'walking',
    packageId: '',
    durationMinutes: 30,
    scheduledAt: '',
    addressId: '',
    notes: '',
    partnerId: '',
    channel: 'phone_call',
  });

  const [customers, setCustomers] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  useEffect(() => {
    wagApi.bookings.getPackages().then(setPackages).catch(() => {});
    wagApi.client.get<any>('/staff/partners?status=approved').then((r: any) => setPartners(r.data ?? [])).catch(() => {});
  }, []);

  const searchCustomer = async () => {
    if (!form.customerPhone.trim()) return;
    setSearchingCustomer(true);
    try {
      const res = await wagApi.client.get<any>(`/staff/customers?search=${form.customerPhone}`) as any;
      const found = res.data?.[0];
      if (!found) { toast({ type: 'error', title: 'Customer not found' }); return; }
      setForm((f) => ({ ...f, customerId: found.id }));
      // Load pets
      const petsRes = await wagApi.client.get<any[]>(`/pets?customerId=${found.id}`) as any;
      setPets(Array.isArray(petsRes) ? petsRes : petsRes.data ?? []);
      // Load addresses
      const userRes = await wagApi.client.get<any>(`/users/me`) as any;
      setAddresses(userRes.addresses ?? []);
      toast({ type: 'success', title: `Found: ${found.profile?.firstName} ${found.profile?.lastName}` });
    } catch {
      toast({ type: 'error', title: 'Search failed' });
    } finally { setSearchingCustomer(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { toast({ type: 'error', title: 'Find customer first' }); return; }
    if (!form.petId) { toast({ type: 'error', title: 'Select a pet' }); return; }
    if (!form.scheduledAt) { toast({ type: 'error', title: 'Set a date and time' }); return; }

    setLoading(true);
    try {
      const res = await wagApi.client.post<any>('/staff/bookings', {
        customerId: form.customerId,
        petId: form.petId,
        type: form.type,
        packageId: form.type === 'grooming' ? form.packageId : undefined,
        durationMinutes: form.type === 'walking' ? form.durationMinutes : undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        addressId: form.addressId || undefined,
        notes: form.notes || undefined,
        partnerId: form.partnerId || undefined,
        channel: form.channel,
      }) as any;
      toast({ type: 'success', title: 'Booking created!', message: `Copy confirmation to send to customer.` });
      navigate(`/bookings/${res.id}`);
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to create booking', message: err?.message });
    } finally { setLoading(false); }
  };

  const update = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bookings')} className="text-[#9E7B6A] hover:text-[#4A1E0B]"><ArrowLeft size={20} /></button>
        <h2 className="text-xl font-extrabold text-[#1A0A03]">New Booking</h2>
      </div>

      <p className="text-sm text-[#9E7B6A] -mt-2">Create a booking from an off-app channel (WhatsApp, phone, walk-in, etc.)</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer search */}
        <FormSection title="Customer">
          <div className="flex gap-2">
            <Input
              placeholder="Search by phone number..."
              value={form.customerPhone}
              onChange={(e) => update('customerPhone', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchCustomer())}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={searchCustomer} loading={searchingCustomer}>Search</Button>
          </div>
          {form.customerId && <p className="text-xs text-green-700 font-semibold mt-1">✓ Customer found</p>}
        </FormSection>

        {/* Channel */}
        <FormSection title="Booking Channel">
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${form.channel === ch ? 'bg-[#4A1E0B] border-[#4A1E0B] text-white' : 'border-[#E8D8CC] text-[#5C3D2E] hover:bg-[#FBF7F2]'}`}
                onClick={() => update('channel', ch)}
              >
                {ch.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Pet */}
        {form.customerId && (
          <FormSection title="Pet">
            <select
              className="w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
              value={form.petId}
              onChange={(e) => update('petId', e.target.value)}
              aria-label="Select pet"
            >
              <option value="">Select a pet...</option>
              {pets.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.breed}</option>)}
            </select>
          </FormSection>
        )}

        {/* Service type */}
        <FormSection title="Service">
          <div className="flex gap-2 mb-3">
            {(['grooming', 'walking'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`flex-1 py-2 rounded-xl border-2 font-semibold text-sm transition-colors ${form.type === t ? 'bg-[#4A1E0B] border-[#4A1E0B] text-white' : 'border-[#E8D8CC] text-[#5C3D2E]'}`}
                onClick={() => update('type', t)}
              >
                {t === 'grooming' ? '✂️ Grooming' : '🐾 Walking'}
              </button>
            ))}
          </div>

          {form.type === 'grooming' && (
            <select
              className="w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
              value={form.packageId}
              onChange={(e) => update('packageId', e.target.value)}
              aria-label="Select package"
            >
              <option value="">Select package...</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>)}
            </select>
          )}

          {form.type === 'walking' && (
            <div className="flex gap-2">
              {[30, 45, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`flex-1 py-2 rounded-xl border-2 font-semibold text-sm ${form.durationMinutes === d ? 'bg-[#4A1E0B] border-[#4A1E0B] text-white' : 'border-[#E8D8CC] text-[#5C3D2E]'}`}
                  onClick={() => update('durationMinutes', d)}
                >
                  {d} min
                </button>
              ))}
            </div>
          )}
        </FormSection>

        {/* Schedule */}
        <FormSection title="Schedule">
          <input
            type="datetime-local"
            className="w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] text-[#1A0A03]"
            value={form.scheduledAt}
            onChange={(e) => update('scheduledAt', e.target.value)}
            aria-label="Scheduled date and time"
          />
        </FormSection>

        {/* Notes */}
        <FormSection title="Notes (optional)">
          <textarea
            className="w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] text-[#1A0A03] resize-none"
            rows={3}
            placeholder="Any special notes for this booking..."
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            aria-label="Booking notes"
          />
        </FormSection>

        {/* Partner (optional) */}
        <FormSection title="Assign Partner (optional)">
          <select
            className="w-full border border-[#E8D8CC] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
            value={form.partnerId}
            onChange={(e) => update('partnerId', e.target.value)}
            aria-label="Select partner"
          >
            <option value="">Leave unassigned</option>
            {partners.map((p: any) => (
              <option key={p.userId} value={p.userId}>
                {p.user?.profile?.firstName} {p.user?.profile?.lastName} — ⭐{p.rating}
              </option>
            ))}
          </select>
        </FormSection>

        <Button type="submit" fullWidth loading={loading}>Create Booking</Button>
      </form>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8D8CC] p-4">
      <p className="text-xs font-bold text-[#9E7B6A] uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}
