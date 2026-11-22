"use client";

import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, Loader2, MessageCircle, Users, Zap } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { MODULES, UsageMeter, humanize } from '@/lib/planMeta';

const SUPPORT_WHATSAPP = '94770481363';
const card = 'rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark';
const eyebrow = 'text-[11px] font-medium uppercase tracking-wider text-nx-text-subtle dark:text-nx-text-strong';

type Limits = { users: number | null; locations: number | null; max_users: number | null; max_locations: number | null; updated_at?: string | null };
type Sub = { name: string; package_name: string; package_modules?: unknown; limits?: Limits };

const fmtDate = (d?: string | null) =>
  d ? new Date(d.replace(' ', 'T')).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export default function PlanUsagePage() {
  const [s, setS] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/client/subscription', {})
      .then(r => (r.ok ? r.json() : null))
      .then(j => setS(j?.data ?? null))
      .catch(() => setS(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-nx-text-muted">
        <Loader2 className="animate-spin" size={16} aria-hidden="true" /> Loading your plan…
      </div>
    );
  }
  if (!s) {
    return <p className="p-6 text-sm text-nx-text-muted">We could not load your plan. Please refresh the page.</p>;
  }

  const L: Partial<Limits> = s.limits ?? {};
  const modules: string[] = Array.isArray(s.package_modules) ? (s.package_modules as unknown[]).filter((m): m is string => typeof m === 'string') : [];
  const near = [[L.users, L.max_users], [L.locations, L.max_locations]].some(([u, m]) => !!m && u != null && u / m >= 0.8);
  const upgradeHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi, I'd like to upgrade my ${s.package_name} plan (${s.name}).`)}`;

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-nx-ink dark:text-white">Plan &amp; usage</h1>
        <p className="mt-1 text-sm text-nx-text-muted dark:text-nx-text-subtle">
          What your <strong>{s.package_name}</strong> plan includes and how much of it you are using.
        </p>
      </div>

      <section aria-label="Plan usage" className={`${card} p-5`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-nx-accent dark:text-nx-accent-light" aria-hidden="true" />
            <h2 className="text-[13px] font-semibold text-nx-ink dark:text-white">Limits</h2>
          </div>
          {L.updated_at && <span className="text-[11px] text-nx-text-subtle">Updated {fmtDate(L.updated_at)}</span>}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <UsageMeter label="Users" used={L.users ?? null} max={L.max_users ?? null} />
          <UsageMeter label="Branches" used={L.locations ?? null} max={L.max_locations ?? null} />
        </div>
        {near && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-nx-warning-soft px-3 py-2 text-[12px] text-nx-warning">
            <AlertCircle size={14} aria-hidden="true" />
            You are close to your plan limit. Upgrade to add more users or branches.
          </p>
        )}
        <a
          href={upgradeHref} target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-nx-accent px-4 text-[13px] font-semibold text-white hover:opacity-90"
        >
          <MessageCircle size={14} aria-hidden="true" /> Upgrade plan
        </a>
      </section>

      <section aria-label="Included modules" className={`${card} p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <Zap size={15} className="text-nx-accent dark:text-nx-accent-light" aria-hidden="true" />
          <h2 className="text-[13px] font-semibold text-nx-ink dark:text-white">Included in {s.package_name}</h2>
        </div>
        {modules.length === 0 ? (
          <p className="text-sm text-nx-text-subtle">No modules listed for this plan.</p>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(mod => {
              const meta = MODULES[mod];
              const Icon = meta?.Icon ?? Activity;
              return (
                <li key={mod} className="flex items-center gap-3 rounded-lg border border-nx-line bg-nx-surface-soft p-3 dark:border-nx-line-dark dark:bg-nx-surface-dark-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-nx-accent/10 dark:bg-nx-accent/15">
                    <Icon size={15} className="text-nx-accent dark:text-nx-accent-light" aria-hidden="true" />
                  </span>
                  <span className="text-[13px] font-medium text-nx-ink dark:text-white">{meta?.label ?? humanize(mod)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
