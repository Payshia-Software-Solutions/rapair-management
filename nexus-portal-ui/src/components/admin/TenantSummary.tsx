"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, CreditCard, ExternalLink, Loader2, PauseCircle, PlayCircle, Receipt, Users } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

type Invoice = { id: number; invoice_number: string; billing_month: string; amount: string; currency: string; status: string; due_date: string | null; balance: string };
export type TenantBilling = {
  invoices: number; billed: number; paid: number; outstanding: number; overdue_count: number; currency: string | null;
  last_payment: { amount: string; created_at: string; receipt_number: string } | null;
  recent: Invoice[];
};
export type TenantInfo = {
  id: string | number; name: string; status: string; admin_email: string; package_name?: string | null;
  monthly_price?: string | number | null; yearly_price?: string | number | null; billing_cycle?: string; currency?: string;
  trial_expiry?: string | null; workspace_url?: string | null; created_at?: string;
  usage_users?: number | null; usage_locations?: number | null; max_users?: number | null; max_locations?: number | null;
  billing?: TenantBilling;
};

const money = (v: unknown) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const daysUntil = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d.slice(0, 10) + 'T00:00:00').getTime();
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000);
};
const STATUS: Record<string, string> = {
  Active: 'border-nx-success/30 bg-nx-success-soft text-nx-success',
  Trial: 'border-nx-info/30 bg-nx-info-soft text-nx-info',
  Suspended: 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger',
  Expired: 'border-nx-warning/30 bg-nx-warning-soft text-nx-warning',
};
const INV: Record<string, string> = { Paid: 'text-nx-success', Overdue: 'text-nx-danger', Pending: 'text-nx-warning', Cancelled: 'text-nx-text-subtle' };

/**
 * Top of the tenant view: who they are, what they pay, what they owe, and the account actions
 * (suspend / reactivate) that used to sit on every row of the tenants list.
 */
export default function TenantSummary({ tenant, onChanged }: { tenant: TenantInfo; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = tenant.billing;
  const cur = b?.currency || tenant.currency || 'USD';
  const yearly = tenant.billing_cycle === 'yearly';
  const price = Number(yearly ? tenant.yearly_price : tenant.monthly_price) || 0;
  const days = daysUntil(tenant.trial_expiry);
  const dateLabel = tenant.status === 'Trial' ? 'Trial ends' : 'Renewal';
  const dateNote = days === null ? 'Not set' : days < 0 ? `${-days} day${days === -1 ? '' : 's'} ago` : days === 0 ? 'Today' : `in ${days} day${days === 1 ? '' : 's'}`;

  const suspend = async () => {
    const reason = prompt(`Suspend ${tenant.name}? Their workspace is locked and they are emailed this reason:`, 'Account suspended by administrator');
    if (!reason) return;
    await act('/admin/tenants/suspend', { id: tenant.id, reason });
  };
  const reactivate = async () => {
    if (!confirm(`Reactivate ${tenant.name}? Their workspace opens again.`)) return;
    await act('/admin/tenants/update-status', { id: tenant.id, status: 'Active' });
  };
  const act = async (path: string, body: object) => {
    setBusy(true); setError(null);
    try {
      const res = await adminFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== 'success') throw new Error(d.message || 'The change failed.');
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'The change failed.'); }
    finally { setBusy(false); }
  };

  const tiles = [
    { icon: CreditCard, label: 'Plan', value: tenant.package_name || 'No plan', note: price ? `USD ${money(price)} / ${yearly ? 'year' : 'month'}` : 'Free' },
    { icon: CalendarClock, label: dateLabel, value: tenant.trial_expiry || '—', note: dateNote, tone: days !== null && days < 0 ? 'danger' : days !== null && days <= 7 ? 'warn' : '' },
    { icon: Receipt, label: 'Outstanding', value: `${cur} ${money(b?.outstanding)}`, note: b?.overdue_count ? `${b.overdue_count} overdue invoice${b.overdue_count === 1 ? '' : 's'}` : 'Nothing overdue', tone: b?.overdue_count ? 'danger' : '' },
    { icon: Users, label: 'Usage', value: `${tenant.usage_users ?? '—'} / ${tenant.max_users ?? '∞'} users`, note: `${tenant.usage_locations ?? '—'} / ${tenant.max_locations ?? '∞'} locations` },
  ];

  return (
    <section aria-label="Tenant summary" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">{tenant.name}</h2>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS[tenant.status] ?? 'border-nx-line text-nx-text-muted'}`}>{tenant.status}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{tenant.admin_email} · {yearly ? 'Yearly' : 'Monthly'} · {tenant.currency || 'USD'}{tenant.created_at ? ` · since ${tenant.created_at.slice(0, 10)}` : ''}</p>
          {tenant.workspace_url && (
            <a href={tenant.workspace_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-nx-accent hover:underline [overflow-wrap:anywhere]">
              {tenant.workspace_url.replace(/^https?:\/\//, '')} <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {tenant.status === 'Suspended' ? (
            <button type="button" onClick={reactivate} disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-nx-success/40 px-3 py-2 text-xs font-semibold text-nx-success hover:bg-nx-success-soft disabled:opacity-60 sm:flex-none">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} Reactivate
            </button>
          ) : (
            <button type="button" onClick={suspend} disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-nx-danger/40 px-3 py-2 text-xs font-semibold text-nx-danger hover:bg-nx-danger-soft disabled:opacity-60 sm:flex-none">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />} Suspend
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-nx-danger"><AlertTriangle size={13} /> {error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {tiles.map(t => (
          <div key={t.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><t.icon size={12} aria-hidden="true" /> {t.label}</p>
            <p className="mt-1 truncate text-[13px] font-bold text-slate-900 dark:text-white sm:text-sm">{t.value}</p>
            <p className={`truncate text-[11px] ${t.tone === 'danger' ? 'font-medium text-nx-danger' : t.tone === 'warn' ? 'text-nx-warning' : 'text-slate-500 dark:text-slate-400'}`}>{t.note}</p>
          </div>
        ))}
      </div>

      {b && b.recent.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Recent invoices · paid {cur} {money(b.paid)} of {money(b.billed)}
            </p>
            <Link href="/admin/invoices" className="text-xs font-semibold text-nx-accent hover:underline">All invoices</Link>
          </div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {b.recent.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{i.invoice_number}</span>
                  <span className="block truncate text-[11px] text-slate-500">{i.billing_month}{i.due_date && i.status !== 'Paid' ? ` · due ${i.due_date}` : ''}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-semibold text-slate-900 dark:text-white">{i.currency} {money(i.amount)}</span>
                  <span className={`block text-[11px] font-medium ${INV[i.status] ?? ''}`}>
                    {i.status}{Number(i.balance) > 0 && Number(i.balance) < Number(i.amount) ? ` · ${money(i.balance)} due` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {b.last_payment && (
            <p className="mt-2 text-[11px] text-slate-500">Last payment {cur} {money(b.last_payment.amount)} on {b.last_payment.created_at.slice(0, 10)} ({b.last_payment.receipt_number})</p>
          )}
        </div>
      )}
    </section>
  );
}
