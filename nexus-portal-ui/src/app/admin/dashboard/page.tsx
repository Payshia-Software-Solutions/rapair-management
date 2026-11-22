"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCcw, AlertTriangle, Clock, Users, Wallet, Receipt, TrendingUp, Inbox, Info, ArrowRight } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

type Summary = {
  base_currency: string;
  kpis: {
    total_tenants: number; active_tenants: number; trial_tenants: number; suspended_tenants: number; expired_tenants: number;
    new_tenants_this_month: number; mrr: number; arr: number; collected_30d: number;
    outstanding: number; outstanding_count: number; overdue: number; overdue_count: number;
    collection_rate_6m: number | null; pending_requests: number;
  };
  trials: { ending_7d: number; ended: number };
  collections_monthly: { month: string; amount: number }[];
  packages: { name: string; count: number; percent: number }[];
  recent_tenants: { id: number; name: string; slug: string; status: string; package: string | null; trial_expiry: string | null; created_at: string }[];
  assumptions: string[];
  missing_rates: string[];
};

const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP'];

const STATUS_PILL: Record<string, string> = {
  Active: 'border-nx-success/30 bg-nx-success-soft text-nx-success',
  Trial: 'border-nx-info/30 bg-nx-info-soft text-nx-info',
  Suspended: 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger',
  Expired: 'border-nx-warning/30 bg-nx-warning-soft text-nx-warning',
};

const fmtMoney = (v: number, cur: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v || 0);

const fmtCompact = (v: number, cur: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);

const monthLabel = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleString('en', { month: 'short' });

function KpiCard({ label, value, sub, icon: Icon, tone = 'accent', href }: {
  label: string; value: string; sub?: React.ReactNode; icon: React.ElementType; tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'violet'; href?: string;
}) {
  const tones: Record<string, string> = {
    accent: 'bg-nx-accent-soft text-nx-accent dark:bg-nx-accent/15 dark:text-nx-accent-light',
    success: 'bg-nx-success-soft text-nx-success',
    warning: 'bg-nx-warning-soft text-nx-warning',
    danger: 'bg-nx-danger-soft text-nx-danger',
    info: 'bg-nx-info-soft text-nx-info',
    violet: 'bg-nx-violet-soft text-nx-violet',
  };
  const body = (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-nx-line bg-white p-5 transition-colors hover:border-nx-accent/40 dark:border-nx-line-dark dark:bg-nx-surface-dark">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-nx-text-muted dark:text-nx-text-subtle">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={16} /></span>
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums tracking-tight text-nx-ink dark:text-white">{value}</div>
        {sub && <div className="mt-1 text-xs text-nx-text-muted dark:text-nx-text-subtle">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function AlertChip({ tone, text, href }: { tone: 'danger' | 'warning' | 'info'; text: string; href: string }) {
  const cls = tone === 'danger' ? 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger'
    : tone === 'warning' ? 'border-nx-warning/30 bg-nx-warning-soft text-nx-warning'
    : 'border-nx-info/30 bg-nx-info-soft text-nx-info';
  return (
    <Link href={href} className={`group flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${cls}`}>
      <span className="flex items-center gap-2">{tone === 'info' ? <Info size={15} /> : <AlertTriangle size={15} />}{text}</span>
      <ArrowRight size={15} className="opacity-60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Responsive column chart in plain HTML: fills its card, no SVG scaling. */
function CollectionsChart({ data, currency }: { data: { month: string; amount: number }[]; currency: string }) {
  const max = Math.max(1, ...data.map(d => d.amount));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const ticks = [1, 0.5, 0];
  return (
    <div className="flex h-72 gap-3">
      {/* Y axis */}
      <div className="flex w-14 shrink-0 flex-col justify-between pb-7 text-right text-[10px] tabular-nums text-nx-text-subtle">
        {ticks.map(t => <span key={t}>{fmtCompact(max * t, currency)}</span>)}
      </div>
      {/* Plot */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-7">
          {ticks.map(t => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-nx-line dark:border-nx-line-dark" style={{ top: `${(1 - t) * 100}%` }} />
          ))}
        </div>
        <div className="relative flex min-h-0 flex-1 items-end gap-2 pb-0">
          {data.map(d => {
            const pct = (d.amount / max) * 100;
            const isNow = d.month === currentMonth;
            return (
              <div key={d.month} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${monthLabel(d.month)}: ${fmtMoney(d.amount, currency)}`}>
                <div className="relative flex w-full flex-1 items-end justify-center">
                  {d.amount > 0 && (
                    <span className="absolute -top-5 whitespace-nowrap text-[10px] font-medium tabular-nums text-nx-text-muted opacity-0 transition-opacity group-hover:opacity-100 dark:text-nx-text-subtle">
                      {fmtCompact(d.amount, currency)}
                    </span>
                  )}
                  <div
                    className={`w-full max-w-[44px] rounded-t-md transition-all duration-500 ${isNow ? 'bg-nx-accent' : d.amount > 0 ? 'bg-nx-accent-light/80 group-hover:bg-nx-accent dark:bg-nx-accent/70' : 'bg-nx-surface-muted dark:bg-nx-line-dark'}`}
                    style={{ height: d.amount > 0 ? `${Math.max(pct, 3)}%` : '3px' }}
                  />
                </div>
                <span className={`mt-2 text-center text-[11px] ${isNow ? 'font-semibold text-nx-ink dark:text-white' : 'text-nx-text-subtle'}`}>{monthLabel(d.month)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Stacked bar of tenant lifecycle states, with counts. */
function TenantHealth({ k }: { k: Summary['kpis'] }) {
  const parts = [
    { label: 'Active', value: k.active_tenants, bar: 'bg-nx-success', dot: 'bg-nx-success' },
    { label: 'Trial', value: k.trial_tenants, bar: 'bg-nx-info', dot: 'bg-nx-info' },
    { label: 'Suspended', value: k.suspended_tenants, bar: 'bg-nx-danger', dot: 'bg-nx-danger' },
    { label: 'Expired', value: k.expired_tenants, bar: 'bg-nx-warning', dot: 'bg-nx-warning' },
  ];
  const total = parts.reduce((a, b) => a + b.value, 0);
  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-nx-surface-muted dark:bg-nx-line-dark" role="img" aria-label="Tenant status breakdown">
        {total > 0 && parts.filter(p => p.value > 0).map(p => (
          <div key={p.label} className={p.bar} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {parts.map(p => (
          <li key={p.label} className="rounded-lg border border-nx-line p-3 dark:border-nx-line-dark">
            <div className="flex items-center gap-2 text-xs text-nx-text-muted dark:text-nx-text-subtle"><span className={`h-2 w-2 rounded-full ${p.dot}`} />{p.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-nx-ink dark:text-white">{p.value}</div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-nx-text-subtle">{total} tenant{total === 1 ? '' : 's'} in total · {k.new_tenants_this_month} new this month</p>
    </div>
  );
}

/** Plan mix: top plans, with the rest behind a toggle so the card keeps its height. */
function PlanMix({ packages }: { packages: Summary['packages'] }) {
  const [all, setAll] = useState(false);
  const shown = all ? packages : packages.slice(0, 5);
  const bars = ['bg-nx-accent', 'bg-nx-success', 'bg-nx-violet', 'bg-nx-info', 'bg-nx-warning', 'bg-nx-rose'];
  return (
    <div>
      <ul className="space-y-4">
        {shown.map((p, i) => (
          <li key={p.name}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-nx-ink dark:text-white" title={p.name}>{p.name}</span>
              <span className="shrink-0 tabular-nums text-nx-text-muted dark:text-nx-text-subtle">{p.count} · {p.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-nx-surface-muted dark:bg-nx-line-dark">
              <div className={`h-full rounded-full ${bars[i % bars.length]}`} style={{ width: `${p.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {packages.length > 5 && (
        <button type="button" onClick={() => setAll(v => !v)} className="mt-4 text-xs font-semibold text-nx-accent hover:underline">
          {all ? 'Show top 5' : `Show all ${packages.length} plans`}
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState('LKR');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(async (cur: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/admin/dashboard/summary?currency=${cur}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== 'success') throw new Error(body.message || 'Could not load the dashboard.');
      setData(body.data);
      setUpdated(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currency); }, [currency, load]);

  const k = data?.kpis;
  const cur = data?.base_currency ?? currency;
  const monthTotal = useMemo(() => data?.collections_monthly.reduce((a, b) => a + b.amount, 0) ?? 0, [data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-nx-ink dark:text-white">Overview</h1>
          <p className="mt-1 text-sm text-nx-text-muted dark:text-nx-text-subtle">
            Platform health, recurring revenue and collections
            {updated && <span className="ml-2 text-xs text-nx-text-subtle">· updated {updated.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="cur">Display currency</label>
          <select id="cur" value={currency} onChange={e => setCurrency(e.target.value)}
            className="rounded-lg border border-nx-line bg-white px-3 py-2 text-sm font-medium text-nx-ink focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => load(currency)} aria-label="Refresh" className="rounded-lg border border-nx-line bg-white p-2.5 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark">
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-nx-danger/30 bg-nx-danger-soft p-4 text-sm text-nx-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* What needs attention right now */}
      {data && (data.trials.ended > 0 || data.trials.ending_7d > 0 || k!.overdue_count > 0 || k!.pending_requests > 0) && (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {data.trials.ended > 0 && <AlertChip tone="danger" href="/admin/tenants?tab=Trial" text={`${data.trials.ended} trial${data.trials.ended === 1 ? '' : 's'} ended and still need a plan`} />}
          {data.trials.ending_7d > 0 && <AlertChip tone="warning" href="/admin/tenants" text={`${data.trials.ending_7d} trial${data.trials.ending_7d === 1 ? '' : 's'} end within 7 days`} />}
          {k!.overdue_count > 0 && <AlertChip tone="danger" href="/admin/invoices" text={`${k!.overdue_count} invoice${k!.overdue_count === 1 ? '' : 's'} overdue · ${fmtMoney(k!.overdue, cur)}`} />}
          {k!.pending_requests > 0 && <AlertChip tone="info" href="/admin/requests" text={`${k!.pending_requests} ERP request${k!.pending_requests === 1 ? '' : 's'} waiting for setup`} />}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Monthly recurring revenue" icon={Wallet} tone="success"
          value={data ? fmtMoney(k!.mrr, cur) : '—'}
          sub={data ? `${fmtMoney(k!.arr, cur)} annualised · active plans only` : 'Loading…'} />
        <KpiCard label="Active tenants" icon={Users} tone="accent" href="/admin/tenants?tab=Active"
          value={data ? String(k!.active_tenants) : '—'}
          sub={data ? `${k!.trial_tenants} on trial · ${k!.suspended_tenants} suspended · ${k!.new_tenants_this_month} new this month` : 'Loading…'} />
        <KpiCard label="Collected (last 30 days)" icon={Receipt} tone="info"
          value={data ? fmtMoney(k!.collected_30d, cur) : '—'}
          sub={data ? `${fmtMoney(monthTotal, cur)} across the last 12 months` : 'Loading…'} />
        <KpiCard label="Outstanding invoices" icon={Clock} tone={k && k.overdue_count > 0 ? 'danger' : 'warning'} href="/admin/invoices"
          value={data ? fmtMoney(k!.outstanding, cur) : '—'}
          sub={data ? `${k!.outstanding_count} open · ${k!.overdue_count} overdue (${fmtMoney(k!.overdue, cur)})` : 'Loading…'} />
      </div>

      {/* Row 1: revenue trend + tenant health (equal height) */}
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <section className="flex flex-col rounded-xl border border-nx-line bg-white p-6 xl:col-span-2 dark:border-nx-line-dark dark:bg-nx-surface-dark">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-nx-ink dark:text-white"><TrendingUp size={15} className="text-nx-accent" /> Collections, last 12 months</h2>
              <p className="mt-1 text-xs text-nx-text-muted dark:text-nx-text-subtle">Payments received, converted to {cur} at the current rate</p>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-[11px] text-nx-text-subtle">Total</div>
                <div className="text-lg font-semibold tabular-nums text-nx-ink dark:text-white">{data ? fmtMoney(monthTotal, cur) : '—'}</div>
              </div>
              <div>
                <div className="text-[11px] text-nx-text-subtle">Collection rate (6 mo)</div>
                <div className="text-lg font-semibold tabular-nums text-nx-ink dark:text-white">{k?.collection_rate_6m != null ? `${k.collection_rate_6m}%` : '—'}</div>
              </div>
            </div>
          </div>
          {data ? (
            monthTotal > 0 ? <CollectionsChart data={data.collections_monthly} currency={cur} /> : (
              <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-dashed border-nx-line text-center dark:border-nx-line-dark">
                <p className="text-sm font-medium text-nx-ink dark:text-white">No payments recorded yet</p>
                <p className="mt-1 text-xs text-nx-text-subtle">Payments appear here once invoices are settled.</p>
              </div>
            )
          ) : <div className="h-72 animate-pulse rounded-lg bg-nx-surface-muted dark:bg-nx-line-dark" />}
        </section>
        <section className="flex flex-col rounded-xl border border-nx-line bg-white p-6 dark:border-nx-line-dark dark:bg-nx-surface-dark">
            <h2 className="text-sm font-semibold text-nx-ink dark:text-white">Tenant health</h2>
            <p className="mt-0.5 mb-5 text-xs text-nx-text-muted dark:text-nx-text-subtle">Every tenant by lifecycle state</p>
            {data ? <TenantHealth k={k!} /> : <div className="h-40 animate-pulse rounded-lg bg-nx-surface-muted dark:bg-nx-line-dark" />}
          </section>
      </div>

      {/* Row 2: newest tenants + plan mix */}
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <section className="overflow-hidden rounded-xl border xl:col-span-2 border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark">
        <div className="flex items-center justify-between border-b border-nx-line px-5 py-4 dark:border-nx-line-dark">
          <div>
            <h2 className="text-sm font-semibold text-nx-ink dark:text-white">Recently registered</h2>
            <p className="text-xs text-nx-text-muted dark:text-nx-text-subtle">Newest six tenants</p>
          </div>
          <Link href="/admin/tenants" className="flex items-center gap-1 text-xs font-semibold text-nx-accent hover:underline">All tenants <ArrowRight size={13} /></Link>
        </div>
        {data && data.recent_tenants.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Inbox size={22} className="text-nx-text-subtle" />
            <p className="text-sm font-medium text-nx-ink dark:text-white">No tenants yet</p>
            <Link href="/admin/tenants/create" className="text-xs font-semibold text-nx-accent hover:underline">Register the first tenant</Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-nx-text-subtle">
              <tr className="border-b border-nx-line dark:border-nx-line-dark">
                <th className="px-5 py-2.5 font-semibold">Tenant</th>
                <th className="px-5 py-2.5 font-semibold">Plan</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 font-semibold">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
              {(data?.recent_tenants ?? []).map(t => (
                <tr key={t.id} onClick={() => router.push(`/admin/tenants/edit/${t.id}`)} className="cursor-pointer hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2">
                  <td className="px-5 py-3">
                    <div className="font-medium text-nx-ink dark:text-white">{t.name}</div>
                    <div className="font-mono text-[11px] text-nx-text-subtle">{t.slug}</div>
                  </td>
                  <td className="px-5 py-3 text-nx-text-muted dark:text-nx-text-subtle">{t.package ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[t.status] ?? 'border-nx-line text-nx-text-muted'}`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3 text-nx-text-muted dark:text-nx-text-subtle">{t.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
              {!data && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-nx-text-subtle">Loading…</td></tr>}
            </tbody>
          </table>
        )}
      </section>
        <section className="rounded-xl border border-nx-line bg-white p-6 dark:border-nx-line-dark dark:bg-nx-surface-dark">
            <h2 className="text-sm font-semibold text-nx-ink dark:text-white">Plan mix</h2>
            <p className="mt-0.5 mb-5 text-xs text-nx-text-muted dark:text-nx-text-subtle">Active and trial tenants by package</p>
            {data && data.packages.length > 0 ? <PlanMix packages={data.packages} /> : <p className="text-sm text-nx-text-subtle">{data ? 'No live tenants yet.' : 'Loading…'}</p>}
          </section>
      </div>

      {/* Method notes: every figure here has a stated definition */}
      {data && (
        <details className="rounded-xl border border-nx-line bg-white p-4 text-xs text-nx-text-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-nx-text-subtle">
          <summary className="cursor-pointer font-medium text-nx-ink dark:text-white">How these numbers are calculated</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {data.assumptions.map(a => <li key={a}>{a}</li>)}
          </ul>
          {data.missing_rates.length > 0 && (
            <p role="alert" className="mt-3 font-medium text-nx-warning">
              Exchange rate missing for {data.missing_rates.join(', ')}. Those amounts are counted as 0 until the rate is synced in Rates.
            </p>
          )}
        </details>
      )}
    </div>
  );
}
