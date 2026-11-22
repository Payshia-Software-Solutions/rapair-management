"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import { Lock, User, ShieldAlert, Loader2, ArrowRight, Zap, Shield, BarChart3, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

const highlights = [
  { icon: Shield,    title: 'Enterprise Security',   desc: 'Role-based access control with encrypted sessions.' },
  { icon: BarChart3, title: 'Real-Time Analytics',   desc: 'Monitor tenants, billing, and platform health.' },
  { icon: Globe,     title: 'Multi-Tenant Platform', desc: 'Manage unlimited SaaS clients from one dashboard.' },
];

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/auth/check`, { credentials: 'include' })
      .then(res => {
        if (res.ok) {
          return res.json().then(data => {
            const dest = data.role === 'super_admin' ? '/admin/dashboard' : '/admin/subscription';
            router.push(dest);
          });
        }
      })
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const dest = data.role === 'super_admin' ? '/admin/dashboard' : '/admin/subscription';
        window.location.href = dest;
      } else {
        setError(data.message || 'Invalid credentials. Please try again.');
      }
    } catch {
      setError('Cannot connect to the server. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white dark:bg-nx-ink">

      {/* ── Left panel (brand) ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-nx-ink dark:bg-nx-surface-dark p-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-nx-accent">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">BIZZFLOW</span>
        </div>

        {/* Main copy */}
        <div>
          <h1 className="mb-4 text-4xl font-bold leading-tight text-white tracking-tight">
            Nexus Admin<br />
            <span className="text-nx-accent-light">Control Centre</span>
          </h1>
          <p className="mb-10 text-[15px] text-nx-text-muted leading-relaxed">
            Manage your entire SaaS ecosystem — tenants, billing, requests, and communications — from one unified workspace.
          </p>

          {/* Feature list */}
          <div className="space-y-5">
            {highlights.map((h, i) => {
              const Icon = h.icon;
              return (
                <div key={i} className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-nx-accent/15">
                    <Icon size={16} className="text-nx-accent-light" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-white">{h.title}</div>
                    <div className="text-[12px] text-nx-text-muted leading-snug mt-0.5">{h.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <div className="text-[11px] text-nx-text-strong">
          © 2026 BizzFlow · Powered by Nebulync
        </div>
      </div>

      {/* ── Right panel (form) ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-nx-accent">
            <Zap size={16} className="text-white fill-white" />
          </div>
          <span className="text-base font-black tracking-tight text-nx-ink dark:text-white">BIZZFLOW</span>
        </div>

        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-nx-ink dark:text-white">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-nx-text-muted dark:text-nx-text-subtle">
              Sign in to your admin account
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-nx-ink dark:text-white">
                Username
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-text-subtle" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="
                    w-full rounded-lg border border-nx-line bg-white py-2.5 pl-9 pr-3
                    text-[13px] text-nx-ink placeholder:text-nx-text-subtle
                    focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20
                    dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white
                    dark:focus:border-nx-accent-light dark:focus:ring-nx-accent-light/20
                    transition-all
                  "
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-nx-ink dark:text-white">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-text-subtle" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="
                    w-full rounded-lg border border-nx-line bg-white py-2.5 pl-9 pr-3
                    text-[13px] text-nx-ink placeholder:text-nx-text-subtle
                    focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20
                    dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white
                    dark:focus:border-nx-accent-light dark:focus:ring-nx-accent-light/20
                    transition-all
                  "
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 rounded-lg border border-nx-danger/30 bg-nx-danger-soft px-3.5 py-3">
                <ShieldAlert size={15} className="shrink-0 text-nx-danger" />
                <span className="text-[12px] font-medium text-nx-danger dark:text-nx-danger">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="
                flex w-full items-center justify-center gap-2 rounded-lg bg-nx-accent py-2.5
                text-[13px] font-semibold text-white
                hover:bg-nx-accent-strong focus:outline-none focus:ring-2 focus:ring-nx-accent/40
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-all
              "
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Signing in…</>
                : <><span>Sign in</span><ArrowRight size={14} /></>
              }
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-nx-text-subtle dark:text-nx-text-strong">
            Protected by Nexus security. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}
