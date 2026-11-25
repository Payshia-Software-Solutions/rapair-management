"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw, Search, Plus, Edit, Trash2, Copy, Check, Eye, EyeOff, ExternalLink, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { adminFetch } from '@/lib/adminApi';

type Tenant = {
  id: number | string;
  name: string;
  slug: string;
  admin_email: string;
  status: 'Active' | 'Trial' | 'Suspended' | 'Expired' | 'pending_trial' | string;
  package_name?: string | null;
  package_id?: number | string;
  billing_cycle?: string;
  currency?: string;
  trial_expiry?: string | null;
  renewal_date?: string | null;
  license_key?: string;
  api_key?: string;
  workspace_url?: string | null;
  provision_status?: string | null;
  created_at?: string;
};

const STATUS_STYLE: Record<string, { pill: string; dot: string; label: string }> = {
  Active:    { pill: 'border-nx-success/30 bg-nx-success-soft text-nx-success', dot: 'bg-nx-success', label: 'Active' },
  Trial:     { pill: 'border-nx-info/30 bg-nx-info-soft text-nx-info', dot: 'bg-nx-info', label: 'Trial' },
  Suspended: { pill: 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger', dot: 'bg-nx-danger', label: 'Suspended' },
  Expired:   { pill: 'border-nx-warning/30 bg-nx-warning-soft text-nx-warning', dot: 'bg-nx-warning', label: 'Expired' },
};
const FALLBACK = { pill: 'border-nx-line bg-nx-surface-muted text-nx-text-muted', dot: 'bg-nx-text-subtle', label: 'Unknown' };
const TABS = ['All', 'Active', 'Trial', 'Suspended', 'Expired'] as const;
const AVATAR = [
  'bg-nx-accent-soft text-nx-accent dark:bg-nx-accent/15 dark:text-nx-accent-light',
  'bg-nx-success-soft text-nx-success',
  'bg-nx-violet-soft text-nx-violet',
  'bg-nx-info-soft text-nx-info',
  'bg-nx-rose-soft text-nx-rose',
  'bg-nx-warning-soft text-nx-warning',
];

const avatarTone = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
};

/** Whole days until a YYYY-MM-DD date (negative once it has passed), or null. */
const daysUntil = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d.slice(0, 10) + 'T00:00:00').getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
};

const maskKey = (k?: string) => (k && k.length > 12 ? `${k.slice(0, 8)}…${k.slice(-4)}` : k || '—');

/** Lifecycle line shown under the status pill. Trial rows carry the urgency. */
function lifecycle(t: Tenant): { text: string; tone: 'muted' | 'warn' | 'danger' } {
  const days = daysUntil(t.trial_expiry || t.renewal_date);
  if (t.status === 'Trial') {
    if (days === null) return { text: 'No end date set', tone: 'warn' };
    if (days < 0) return { text: `Trial ended ${-days} day${days === -1 ? '' : 's'} ago. Needs follow-up`, tone: 'danger' };
    if (days === 0) return { text: 'Trial ends today', tone: 'warn' };
    return { text: `${days} day${days === 1 ? '' : 's'} left in trial`, tone: days <= 7 ? 'warn' : 'muted' };
  }
  if (t.status === 'Active' && days !== null) {
    return { text: days < 0 ? `Renewal overdue by ${-days} days` : `Renews in ${days} day${days === 1 ? '' : 's'}`, tone: days < 0 ? 'danger' : days <= 7 ? 'warn' : 'muted' };
  }
  return { text: t.status === 'Suspended' ? 'Access paused' : t.status === 'Expired' ? 'Subscription lapsed' : '', tone: 'muted' };
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');
  // Deep links from the dashboard, e.g. /admin/tenants?tab=Trial. Read after mount to keep SSR and client markup equal.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab') ?? '';
    if ((TABS as readonly string[]).includes(requested)) setTab(requested as (typeof TABS)[number]);
  }, []);
  const [plan, setPlan] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const perPage = 10;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/admin/tenants');
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Could not load tenants.');
      setTenants(data.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [tab, plan, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: tenants.length };
    tenants.forEach(t => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [tenants]);

  const trialAlerts = useMemo(() => tenants.filter(t => t.status === 'Trial' && (daysUntil(t.trial_expiry) ?? 999) <= 7).length, [tenants]);

  const plans = useMemo(() => Array.from(new Set(tenants.map(t => t.package_name).filter(Boolean))) as string[], [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter(t => {
      if (tab !== 'All' && t.status !== tab) return false;
      if (plan !== 'all' && t.package_name !== plan) return false;
      if (!q) return true;
      return [t.name, t.slug, t.admin_email, t.license_key].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [tenants, tab, plan, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const remove = async (t: Tenant) => {
    if (!confirm(`Delete ${t.name}? Their workspace stops working and the record is hidden. This cannot be undone here.`)) return;
    try {
      const res = await adminFetch('/admin/tenants/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Delete failed.');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-nx-ink dark:text-white">Tenants</h1>
          <p className="mt-1 text-sm text-nx-text-muted dark:text-nx-text-subtle">
            {tenants.length} workspace{tenants.length === 1 ? '' : 's'} on the platform
            {trialAlerts > 0 && <span className="ml-2 font-medium text-nx-warning">· {trialAlerts} trial{trialAlerts === 1 ? '' : 's'} ending within 7 days</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-nx-line bg-white p-2.5 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark" aria-label="Refresh">
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => router.push('/admin/tenants/create')} className="flex items-center gap-1.5 rounded-lg bg-nx-accent-strong px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-nx-accent">
            <Plus size={15} /> Register tenant
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-nx-danger/30 bg-nx-danger-soft p-4 text-sm text-nx-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filter by status" className="flex gap-1 overflow-x-auto rounded-xl border border-nx-line bg-white p-1 dark:border-nx-line-dark dark:bg-nx-surface-dark">
          {TABS.map(t => {
            const on = tab === t;
            return (
              <button key={t} role="tab" aria-selected={on} onClick={() => setTab(t)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'bg-nx-accent-soft text-nx-accent dark:bg-nx-accent/15 dark:text-nx-accent-light' : 'text-nx-text-muted hover:text-nx-ink dark:text-nx-text-subtle dark:hover:text-white'}`}>
                {t === 'All' ? 'All' : STATUS_STYLE[t]?.label ?? t}
                <span className="rounded-md bg-nx-surface-muted px-1.5 text-xs tabular-nums text-nx-text-muted dark:bg-nx-line-dark dark:text-nx-text-subtle">{counts[t] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={plan} onChange={e => setPlan(e.target.value)} aria-label="Filter by plan"
            className="rounded-lg border border-nx-line bg-white px-3 py-2 text-sm text-nx-ink focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white">
            <option value="all">All plans</option>
            {plans.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="relative w-full sm:w-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-text-subtle" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, slug, email or license…" aria-label="Search tenants"
              className="w-full sm:w-72 rounded-lg border border-nx-line bg-white py-2 pl-9 pr-3 text-sm text-nx-ink placeholder:text-nx-text-subtle focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white" />
          </div>
        </div>
      </div>

      {/* Phones: one card per tenant. Suspend and the keys live in the tenant view. */}
      <div className="overflow-hidden rounded-xl border border-nx-line bg-white md:hidden dark:border-nx-line-dark dark:bg-nx-surface-dark">
        {loading && <p className="px-4 py-10 text-center text-sm text-nx-text-subtle">Loading tenants…</p>}
        {!loading && pageItems.length === 0 && <p className="px-4 py-10 text-center text-sm text-nx-text-subtle">No tenants match these filters</p>}
        <ul className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
          {!loading && pageItems.map(t => {
            const st = STATUS_STYLE[t.status] ?? FALLBACK;
            const life = lifecycle(t);
            return (
              <li key={t.id}>
                <button type="button" onClick={() => router.push(`/admin/tenants/edit/${t.id}`)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-nx-surface-soft ${t.status === 'Trial' && life.tone === 'danger' ? 'bg-nx-danger-soft/40' : ''}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${avatarTone(t.name)}`}>{t.name.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-nx-ink dark:text-white">{t.name}</span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.pill}`}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span>
                    </span>
                    <span className="block truncate text-xs text-nx-text-muted dark:text-nx-text-subtle">{t.package_name || 'No package'} · <span className="capitalize">{t.billing_cycle || 'monthly'}</span> · {t.currency || 'USD'}</span>
                    {life.text && <span className={`block truncate text-[11px] ${life.tone === 'danger' ? 'font-medium text-nx-danger' : life.tone === 'warn' ? 'text-nx-warning' : 'text-nx-text-subtle'}`}>{life.text}</span>}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-nx-text-subtle" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} itemsPerPage={perPage} />
      </div>

      {/* Table (tablets and up) */}
      <div className="hidden overflow-hidden rounded-xl border border-nx-line bg-white md:block dark:border-nx-line-dark dark:bg-nx-surface-dark">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-nx-line bg-nx-surface-soft text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:border-nx-line-dark dark:bg-nx-surface-dark-2 dark:text-nx-text-subtle">
              <tr>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Status & lifecycle</th>
                <th className="px-5 py-3">Keys</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
              {loading && (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-nx-text-subtle">Loading tenants…</td></tr>
              )}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <p className="text-sm font-medium text-nx-ink dark:text-white">No tenants match these filters</p>
                    <p className="mt-1 text-xs text-nx-text-subtle">Clear the search or pick another status.</p>
                  </td>
                </tr>
              )}
              {!loading && pageItems.map(t => {
                const st = STATUS_STYLE[t.status] ?? FALLBACK;
                const life = lifecycle(t);
                const urgent = t.status === 'Trial' && life.tone === 'danger';
                const url = t.workspace_url || `${t.slug}`;
                return (
                  <tr key={t.id} className={`group transition-colors hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2 ${urgent ? 'bg-nx-danger-soft/40 dark:bg-nx-danger-soft/30' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${avatarTone(t.name)}`}>
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <button onClick={() => router.push(`/admin/tenants/edit/${t.id}`)} className="block truncate text-sm font-medium text-nx-ink hover:text-nx-accent dark:text-white">{t.name}</button>
                          <div className="truncate text-xs text-nx-text-muted dark:text-nx-text-subtle">{t.admin_email}</div>
                          <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-nx-text-subtle">
                            <span className="truncate">{url}</span>
                            {t.workspace_url && (
                              <a href={t.workspace_url} target="_blank" rel="noreferrer" aria-label={`Open ${t.name} workspace`} className="hover:text-nx-accent"><ExternalLink size={11} /></a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="text-sm text-nx-ink dark:text-white">{t.package_name || <span className="text-nx-text-subtle">No package</span>}</div>
                      <div className="mt-1 text-xs capitalize text-nx-text-muted dark:text-nx-text-subtle">{t.billing_cycle || 'monthly'} · {t.currency || 'USD'}</div>
                    </td>

                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
                      </span>
                      {life.text && (
                        <div className={`mt-1.5 flex items-center gap-1 text-xs ${life.tone === 'danger' ? 'font-medium text-nx-danger' : life.tone === 'warn' ? 'text-nx-warning' : 'text-nx-text-muted dark:text-nx-text-subtle'}`}>
                          {life.tone !== 'muted' && <Clock size={11} />}{life.text}
                        </div>
                      )}
                      {t.provision_status && t.provision_status !== 'ready' && (
                        <div className="mt-1 text-[11px] text-nx-text-subtle">Provisioning: {t.provision_status}</div>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {[
                        { key: 'lic', label: 'License', value: t.license_key },
                        { key: 'api', label: 'API key', value: t.api_key },
                      ].map(row => {
                        const id = `${row.key}-${t.id}`;
                        const shown = revealed[id] ? row.value : maskKey(row.value);
                        return (
                          <div key={row.key} className="flex items-center gap-1.5 py-0.5">
                            <span className="w-14 text-[10px] uppercase tracking-wide text-nx-text-subtle">{row.label}</span>
                            <code className="max-w-[170px] truncate rounded bg-nx-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-nx-text-muted dark:bg-nx-line-dark dark:text-nx-text-subtle">{shown || '—'}</code>
                            {row.value && (
                              <>
                                <button onClick={() => setRevealed(r => ({ ...r, [id]: !r[id] }))} aria-label={revealed[id] ? 'Hide key' : 'Show key'} className="rounded p-1 text-nx-text-subtle hover:text-nx-accent">
                                  {revealed[id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                                <button onClick={() => copy(row.value!, id)} aria-label="Copy key" className="rounded p-1 text-nx-text-subtle hover:text-nx-accent">
                                  {copied === id ? <Check size={12} className="text-nx-success" /> : <Copy size={12} />}
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                        <button onClick={() => router.push(`/admin/tenants/edit/${t.id}`)} className="rounded-md p-2 text-nx-text-subtle hover:bg-nx-surface-muted hover:text-nx-accent dark:hover:bg-nx-line-dark" aria-label={`Edit ${t.name}`}>
                          <Edit size={15} />
                        </button>
                        <button onClick={() => remove(t)} className="rounded-md p-2 text-nx-text-subtle hover:bg-nx-danger-soft hover:text-nx-danger" aria-label={`Delete ${t.name}`}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} itemsPerPage={perPage} />
      </div>
    </div>
  );
}
