import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, useToast } from '@wag/ui-web';
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
      if (res.user.role !== 'admin') {
        toast({ type: 'error', title: 'Access denied', message: 'This console is for super admins only.' });
        return;
      }
      const p = res.profile as any;
      setAuth({
        accessToken: res.tokens.accessToken,
        refreshToken: res.tokens.refreshToken,
        userId: res.user.id,
        email: res.user.email ?? '',
        name: p ? `${p.firstName} ${p.lastName}` : 'Admin',
      });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ type: 'error', title: 'Login failed', message: err?.message ?? 'Check your credentials.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FBF7F2] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#4A1E0B] flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🐾</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#4A1E0B]">Wag & Tails</h1>
          <p className="text-sm text-[#9E7B6A] mt-1 tracking-wide">Super Admin Console</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-[#E8D8CC] p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Admin sign in</h2>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@wagandtails.in" required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          <Button type="submit" fullWidth loading={loading}>Sign In</Button>
        </form>
        <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-200 text-xs text-blue-700">
          <p className="font-bold mb-1">🧪 Test account</p>
          <p>admin@wagandtails.in / WagTails@123</p>
        </div>
      </div>
    </div>
  );
}
