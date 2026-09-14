import React, { useState } from 'react';
import { PageHeader, Card, CardHeader, CardTitle, Kv, Button, useToast } from '@wag/ui-web';
import { useAuthStore } from '../store/auth.store';

export default function ProfilePage() {
  const { name, email } = useAuthStore();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(name ?? '');
  const [emailValue, setEmailValue] = useState(email ?? '');

  return (
    <div>
      <PageHeader title="Your profile" />
      <div className="p-4 md:p-7 grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <span className="w-[76px] h-[76px] rounded-full bg-[#F07B2C] grid place-items-center text-2xl font-bold text-white shrink-0">
              {(name ?? 'S').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="font-extrabold text-2xl text-[#1C1006] truncate">{name ?? 'Staff'}</div>
              <div className="text-sm text-[#6E5B4B] mt-1 truncate">Bookings staff · {email}</div>
            </div>
          </div>
          <div className="h-px bg-[#EDE4D9] my-4" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[12.5px] font-semibold text-[#4A3A2C] mb-1.5">Full name</div>
              <div className="bg-white border border-[#E2D5C6] rounded-xl px-3.5 py-3">
                <input className="w-full outline-none text-[15px]" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-[#4A3A2C] mb-1.5">Email</div>
              <div className="bg-white border border-[#E2D5C6] rounded-xl px-3.5 py-3">
                <input className="w-full outline-none text-[15px]" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} />
              </div>
            </div>
          </div>
          <Button className="mt-4" onClick={() => toast({ type: 'success', title: 'Profile saved' })}>
            Save changes
          </Button>
        </Card>
        <Card>
          <CardHeader><CardTitle>This shift</CardTitle></CardHeader>
          <Kv k="Bookings created" v="—" />
          <Kv k="Tickets handled" v="—" />
        </Card>
      </div>
    </div>
  );
}
