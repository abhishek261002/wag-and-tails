import React from 'react';
import { PageHeader, Card, CardHeader, CardTitle, Badge, Button, useToast, Icon, MoneySettingsCard } from '@wag/ui-web';
import { wagApi } from '../lib/api';

const INTEGRATIONS = [
  { icon: 'chat', tone: 'ok', title: 'WhatsApp Business API', sub: 'Not connected in this environment', live: false },
  { icon: 'card', title: 'Razorpay', sub: 'Payments and payouts', live: true },
  { icon: 'nav', title: 'Ola Maps', sub: 'Geocoding and live tracking', live: true },
  { icon: 'bag', title: 'Shiprocket', sub: 'Store fulfilment', live: false },
];

export default function SettingsPage() {
  const { toast } = useToast();

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="p-4 md:p-7 grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Business</CardTitle></CardHeader>
            <div className="grid grid-cols-2 gap-4">
              <ReadOnlyField label="Business name" value="Wag & Tails" />
              <ReadOnlyField label="Store brand" value="The Indian Pet Company" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <ReadOnlyField label="Support phone" value="+91 90040 22022" />
              <ReadOnlyField label="Support hours" value="9:00 am – 9:00 pm" />
            </div>
          </Card>

          <MoneySettingsCard api={wagApi.client} canEdit />

          <Card>
            <CardHeader><CardTitle>Cancellation</CardTitle></CardHeader>
            <div className="grid grid-cols-2 gap-4">
              <ReadOnlyField label="Free cancellation window" value="4 hours" />
              <ReadOnlyField label="Late cancellation fee" value="₹200" />
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <div className="flex flex-col">
              {INTEGRATIONS.map((i) => (
                <div key={i.title} className="flex items-center gap-3 py-3 border-b border-[#EDE4D9] last:border-0">
                  <span className="w-[38px] h-[38px] rounded-[12px] bg-[#F9F1E9] text-[#4A1E0B] grid place-items-center shrink-0">
                    <Icon name={i.icon} size={19} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{i.title}</div>
                    <div className="text-xs text-[#9A8878] mt-0.5">{i.sub}</div>
                  </div>
                  <Badge variant={i.live ? 'ok' : 'muted'}>{i.live ? 'Live' : 'Not connected'}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Danger zone</CardTitle></CardHeader>
          <div className="flex flex-col gap-2">
            <Button compact variant="ghost" className="!justify-start" leftIcon={<Icon name="doc" size={15} />} onClick={() => toast({ type: 'success', title: 'Export started' })}>
              Export all data
            </Button>
            <Button compact variant="danger" className="!justify-start" leftIcon={<Icon name="alert" size={15} />} onClick={() => toast({ type: 'error', title: 'Not available in this environment' })}>
              Pause all bookings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12.5px] font-semibold text-[#4A3A2C] mb-1.5">{label}</div>
      <div className="bg-[#F4EDE5] border border-[#EDE4D9] rounded-xl px-3.5 py-3 text-[15px] text-[#1C1006]">{value}</div>
    </div>
  );
}
