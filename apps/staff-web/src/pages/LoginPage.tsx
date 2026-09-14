import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, useToast, Logo } from '@wag/ui-web';
import { wagApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await wagApi.auth.login({ email: email.trim().toLowerCase(), password });
      if (!['staff', 'admin'].includes(res.user.role)) {
        toast({ type: 'error', title: 'Access denied', message: 'This portal is for staff and admins only.' });
        return;
      }
      const profile = res.profile as any;
      setAuth({
        accessToken: res.tokens.accessToken,
        refreshToken: res.tokens.refreshToken,
        userId: res.user.id,
        role: res.user.role,
        email: res.user.email ?? '',
        name: profile ? `${profile.firstName} ${profile.lastName}` : 'Staff',
      });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ type: 'error', title: 'Login failed', message: err?.message ?? 'Check your credentials.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#FBF7F2]">
      <div className="hidden lg:flex flex-col justify-between bg-[#4A1E0B] text-white p-14">
        <Logo size={52} ink="#fff" ground="#4A1E0B" />
        <div>
          <div className="font-extrabold text-[38px] leading-tight" style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>Staff portal</div>
          <p className="text-white/72 mt-3 max-w-sm text-[15px] leading-relaxed">
            Take bookings from customers, assign partners and keep the day moving.
          </p>
        </div>
        <div className="text-xs text-white/40">Wag &amp; Tails &middot; EST. 2022</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">
          <div className="font-extrabold text-2xl text-[#1C1006]" style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>Sign in</div>
          <p className="text-sm text-[#6E5B4B] mt-2">Use your work email address.</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <div className="text-[12.5px] font-semibold text-[#4A3A2C] mb-1.5">Email</div>
              <div className="bg-white border border-[#E2D5C6] rounded-xl px-3.5 py-3 focus-within:border-[#4A1E0B] focus-within:ring-2 focus-within:ring-[#4A1E0B]/10">
                <input
                  className="w-full outline-none text-[15px] bg-transparent"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@wagandtails.in"
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-[#4A3A2C] mb-1.5">Password</div>
              <div className="bg-white border border-[#E2D5C6] rounded-xl px-3.5 py-3 focus-within:border-[#4A1E0B] focus-within:ring-2 focus-within:ring-[#4A1E0B]/10">
                <input
                  className="w-full outline-none text-[15px] bg-transparent"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <Button type="submit" fullWidth loading={loading} className="mt-2">Sign in</Button>
          </form>

          <div className="mt-6 text-xs text-[#9A8878] text-center border-t border-[#EDE4D9] pt-4">
            Test accounts: staff@wagandtails.in / admin@wagandtails.in &middot; WagTails@123
          </div>
        </div>
      </div>
    </div>
  );
}
