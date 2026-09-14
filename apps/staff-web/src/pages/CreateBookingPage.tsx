import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Button, Input, useToast, Card, CardHeader, CardTitle, FilterChip, Tile, RatingChip, Kv } from '@wag/ui-web';
import { wagApi } from '../lib/api';

const CHANNELS = ['app', 'whatsapp', 'phone_call', 'instagram', 'walk_in', 'other'];

export default function CreateBookingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState({
    customerPhone: '',
    customerId: '',
    customerName: '',
    petId: '',
    type: 'grooming' as 'grooming' | 'walking',
    packageId: '',
    durationMinutes: 30,
    scheduledAt: '',
    addressId: '',
    notes: '',
    partnerId: '',
    partnerName: '',
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
      setCustomers(res.data);
      setForm((f) => ({ ...f, customerId: found.id, customerName: `${found.profile?.firstName ?? ''} ${found.profile?.lastName ?? ''}`.trim() }));
      const petsRes = await wagApi.client.get<any[]>(`/pets?customerId=${found.id}`) as any;
      setPets(Array.isArray(petsRes) ? petsRes : petsRes.data ?? []);
      const userRes = await wagApi.client.get<any>(`/users/me`) as any;
      setAddresses(userRes.addresses ?? []);
      toast({ type: 'success', title: `Found: ${found.profile?.firstName} ${found.profile?.lastName}` });
    } catch {
      toast({ type: 'error', title: 'Search failed' });
    } finally { setSearchingCustomer(false); }
  };

  const selectedPackage = packages.find((p: any) => p.id === form.packageId);
  const total = form.type === 'grooming' ? Number(selectedPackage?.price ?? 0) : form.durationMinutes === 60 ? 599 : form.durationMinutes === 45 ? 449 : 299;
  const canSubmit = !!form.customerId && !!form.petId && !!form.scheduledAt && (form.type === 'grooming' ? !!form.packageId : true);

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (!form.customerId) toast({ type: 'error', title: 'Find the customer first' });
      else if (!form.petId) toast({ type: 'error', title: 'Select a pet' });
      else if (!form.scheduledAt) toast({ type: 'error', title: 'Set a date and time' });
      return;
    }
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
      toast({ type: 'success', title: 'Booking created', message: 'Copy the confirmation to send to the customer.' });
      navigate(`/bookings/${res.id}`);
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to create booking', message: err?.message });
    } finally { setLoading(false); }
  };

  const update = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader title="New booking" sub={form.customerId ? `${form.customerName}` : 'Entered by staff'} />
      <div className="p-4 md:p-7 grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>1 &middot; Customer</CardTitle></CardHeader>
            <div className="flex gap-2">
              <Input
                placeholder="Search by phone number…"
                value={form.customerPhone}
                onChange={(e) => update('customerPhone', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchCustomer())}
                className="flex-1"
              />
              <Button compact variant="ghost" onClick={searchCustomer} loading={searchingCustomer}>Search</Button>
            </div>
            {form.customerId && <p className="text-xs text-[#1F7A4D] font-semibold mt-2">Customer found — {form.customerName}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <FilterChip key={ch} active={form.channel === ch} onClick={() => update('channel', ch)}>
                  {ch.replace(/_/g, ' ')}
                </FilterChip>
              ))}
            </div>
          </Card>

          {form.customerId && (
            <Card>
              <CardHeader><CardTitle>2 &middot; Pet</CardTitle></CardHeader>
              <select
                className="w-full border border-[#E2D5C6] rounded-xl px-3.5 py-3 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C]"
                value={form.petId}
                onChange={(e) => update('petId', e.target.value)}
                aria-label="Select pet"
              >
                <option value="">Select a pet…</option>
                {pets.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.breed}</option>)}
              </select>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>3 &middot; Service</CardTitle></CardHeader>
            <div className="flex gap-2 mb-3">
              {(['grooming', 'walking'] as const).map((t) => (
                <FilterChip key={t} active={form.type === t} onClick={() => update('type', t)}>
                  {t === 'grooming' ? 'Grooming' : 'Dog walking'}
                </FilterChip>
              ))}
            </div>

            {form.type === 'grooming' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {packages.map((p: any) => (
                  <Tile key={p.id} selected={form.packageId === p.id} onClick={() => update('packageId', p.id)}>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block font-bold text-[15px]">{p.name}</span>
                      <span className="block text-xs text-[#9A8878] mt-0.5">{p.durationMinutes ?? ''} min</span>
                    </span>
                    <span className="font-extrabold text-[15px]">₹{p.price}</span>
                  </Tile>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {[30, 45, 60].map((d) => (
                  <Tile key={d} selected={form.durationMinutes === d} onClick={() => update('durationMinutes', d)} className="flex-col items-start">
                    <span className="font-bold text-[15px]">{d} minutes</span>
                    <span className="font-extrabold text-[15px] mt-1">₹{d === 60 ? 599 : d === 45 ? 449 : 299}</span>
                  </Tile>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>4 &middot; Slot</CardTitle></CardHeader>
            <input
              type="datetime-local"
              className="w-full border border-[#E2D5C6] rounded-xl px-3.5 py-3 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] text-[#1C1006]"
              value={form.scheduledAt}
              onChange={(e) => update('scheduledAt', e.target.value)}
              aria-label="Scheduled date and time"
            />
            <textarea
              className="w-full border border-[#E2D5C6] rounded-xl px-3.5 py-3 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#F07B2C] text-[#1C1006] resize-none mt-3"
              rows={3}
              placeholder="Anything the customer mentioned on the call or chat"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              aria-label="Care notes"
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5 &middot; Assign a partner</CardTitle>
              <span className="text-xs text-[#9A8878]">Or leave unassigned</span>
            </CardHeader>
            <div className="flex flex-col gap-2.5">
              {partners
                .filter((p: any) => (p.modes ?? []).includes(form.type === 'grooming' ? 'grooming' : 'walking'))
                .map((p: any) => (
                  <Tile key={p.userId} selected={form.partnerId === p.userId} onClick={() => update('partnerId', p.userId)}>
                    <span className="w-10 h-10 rounded-full shrink-0 grid place-items-center font-bold text-white" style={{ background: form.type === 'grooming' ? '#F07B2C' : '#1F7A4D' }}>
                      {(p.user?.profile?.firstName ?? '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block font-bold text-[15px] truncate">{p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : '—'}</span>
                      <span className="block text-xs text-[#9A8878] mt-0.5">{p.city ?? '—'} &middot; {p.completedJobs} jobs</span>
                    </span>
                    <RatingChip value={Number(p.rating).toFixed(1)} />
                  </Tile>
                ))}
              <Tile selected={!form.partnerId} onClick={() => update('partnerId', '')}>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block font-bold text-[15px]">Leave unassigned</span>
                  <span className="block text-xs text-[#9A8878] mt-0.5">Publish as an open job for partners to claim</span>
                </span>
              </Tile>
            </div>
          </Card>
        </div>

        <div>
          <Card className="lg:sticky lg:top-4">
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <Kv k="Customer" v={form.customerName || '—'} />
            <Kv k="Service" v={form.type === 'grooming' ? (selectedPackage?.name ?? '—') : `${form.durationMinutes} min walk`} />
            <Kv k="When" v={form.scheduledAt ? new Date(form.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} />
            <Kv k="Partner" v={partners.find((p: any) => p.userId === form.partnerId)?.user?.profile?.firstName ?? 'Unassigned'} />
            <div className="h-px bg-[#EDE4D9] my-3" />
            <Kv k="Total" v={<span className="text-[17px] font-extrabold">₹{total}</span>} />
            <p className="text-xs text-[#9A8878] mt-3">The customer pays after the service. A confirmation can be copied and sent on WhatsApp.</p>
            <Button fullWidth className="mt-4" onClick={handleSubmit} loading={loading} disabled={!canSubmit}>
              Create booking &amp; send confirmation
            </Button>
            <Button fullWidth variant="ghost" className="mt-2.5" onClick={() => navigate('/bookings')}>Cancel</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
