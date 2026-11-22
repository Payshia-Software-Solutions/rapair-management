"use client"

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock, LogOut, Mail, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { signOut } from '@/lib/session';

const SUPPORT_EMAIL = 'support@nebulync.com';

type Plan = { id: string | number; name: string; monthly_price?: number | string; price?: number | string; max_users?: number | string | null; max_locations?: number | string | null };
type SaasConfig = { status?: string; trial_expiry?: string | null; renewal_date?: string | null; package_name?: string; name?: string; tenant_name?: string };

function readRole(): string {
  try {
    const token = window.localStorage.getItem('auth_token');
    if (!token) return '';
    const part = token.split('.')[1];
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload?.role ?? '');
  } catch {
    return '';
  }
}

export default function TrialEndedPage() {
  const [config, setConfig] = useState<SaasConfig | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(readRole().toLowerCase() === 'admin');
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    Promise.all([
      fetch(`${base}/api/saas/config`).then(r => r.json()).catch(() => null),
      fetch(`${base}/api/saas/packages`).then(r => r.json()).catch(() => null),
    ]).then(([cfg, pk]) => {
      if (cfg?.status === 'success' && cfg.data) setConfig(cfg.data);
      if (pk?.status === 'success' && Array.isArray(pk.data)) setPlans(pk.data);
    }).finally(() => setLoading(false));
  }, []);

  const currentName = config?.package_name || config?.name || '';
  const upgradePlans = useMemo(
    () => plans.filter(p => (p.name || '').toLowerCase() !== currentName.toLowerCase()),
    [plans, currentName]
  );

  const trialEnded = useMemo(() => {
    const d = config?.trial_expiry || config?.renewal_date;
    if (!d) return false;
    const t = new Date(d).getTime();
    return !Number.isNaN(t) && Date.now() >= t + 86_400_000;
  }, [config]);

  const expiryLabel = config?.trial_expiry || config?.renewal_date || '';
  const tenantName = config?.tenant_name || '';

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-background/95 px-6 py-4 backdrop-blur">
        <img src="/bizzflow-logo.png" alt="BizzFlow" className="h-9 w-auto object-contain" />
        <Button variant="ghost" size="sm" className="gap-2 text-red-600 hover:text-red-700" onClick={() => signOut('/login')}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your subscription...</p>
        ) : !trialEnded ? (
          <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
            <Clock className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-2xl font-bold">Your trial is still active</h1>
            <p className="text-sm text-muted-foreground">
              {expiryLabel ? `It runs until ${expiryLabel}.` : 'You can keep using BizzFlow.'}
            </p>
            <Button asChild className="rounded-xl"><Link href="/dashboard/overall">Go to dashboard</Link></Button>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/40 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                  <ShieldAlert className="h-6 w-6" />
                </span>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold text-red-950 dark:text-red-100">Your free trial has ended</h1>
                  <p className="text-sm text-red-900/80 dark:text-red-200/80">
                    {tenantName ? `${tenantName}'s` : 'Your'} trial ended{expiryLabel ? ` on ${expiryLabel}` : ''}.
                    You can still sign in and view your data, but changes are disabled until you choose a package.
                  </p>
                </div>
              </div>
              {isAdmin ? (
                <Button asChild className="shrink-0 rounded-xl gap-2">
                  <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Upgrade ${tenantName} to continue`)}`}>
                    <Mail className="h-4 w-4" /> Upgrade package
                  </a>
                </Button>
              ) : (
                <Badge variant="outline" className="w-fit border-red-300 text-red-800 dark:text-red-200">
                  Ask your administrator to upgrade
                </Badge>
              )}
            </section>

            {currentName && (
              <p className="text-sm text-muted-foreground">
                Current plan: <span className="font-semibold text-foreground">{currentName}</span>
              </p>
            )}

            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Choose a package to continue</h2>
                <p className="text-sm text-muted-foreground">Pick the plan that fits your workshop. Your data stays exactly as it is.</p>
              </div>

              {plans.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Packages are unavailable right now. Contact {SUPPORT_EMAIL} to upgrade.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(upgradePlans.length > 0 ? upgradePlans : plans).map(p => {
                    const price = Number(p.monthly_price ?? p.price ?? 0);
                    return (
                      <div key={p.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold">{p.name}</h3>
                        </div>
                        <div className="mt-4 text-3xl font-black tabular-nums">
                          {price > 0 ? price.toLocaleString() : 'Custom'}
                          {price > 0 && <span className="ml-1 text-sm font-semibold text-muted-foreground">/ month</span>}
                        </div>
                        {(p.max_users || p.max_locations) && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Up to {p.max_users || 'unlimited'} users · {p.max_locations || 'unlimited'} sites
                          </p>
                        )}
                        <div className="mt-auto pt-5">
                          {isAdmin ? (
                            <Button asChild className="w-full rounded-xl gap-2">
                              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Switch ${tenantName} to ${p.name}`)}`}>
                                Upgrade to {p.name} <ArrowUpRight className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="outline" disabled className="w-full rounded-xl">Ask your administrator</Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <p className="text-xs text-muted-foreground">
              Need help? Email <a className="font-semibold underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              {' '}<button className="underline" onClick={() => window.location.reload()}>Refresh status</button>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
