"use client";

import { adminFetch } from '@/lib/adminApi';
import { API_BASE } from '@/config';
import { BUSINESS_TYPES } from '@/lib/businessTypes';
import WorkspaceAddressChange from '@/components/WorkspaceAddressChange';
import CustomDomainCard from '@/components/CustomDomainCard';
import SetupProgress from '@/components/SetupProgress';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, RefreshCcw, FileText, Download, CheckCircle2, AlertCircle, Clock, ExternalLink, Copy, Check,
  Eye, EyeOff, Pencil, Loader2, Rocket, MessageCircle, ShieldAlert,
} from 'lucide-react';

const SUPPORT_WHATSAPP = '94770481363';

const fmtDate = (d?: string | null) =>
  d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const card = 'rounded-xl border border-nx-line bg-white dark:border-nx-line-dark dark:bg-nx-surface-dark';
const inputCls = 'h-11 w-full rounded-xl border border-nx-line bg-white px-3.5 text-sm text-nx-ink focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white';
const eyebrow = 'text-[11px] font-medium uppercase tracking-wider text-nx-text-subtle dark:text-nx-text-strong';

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    Paid:    { cls: 'border-nx-success/30 bg-nx-success-soft text-nx-success', icon: <CheckCircle2 size={10} aria-hidden="true" /> },
    Overdue: { cls: 'border-nx-danger/30 bg-nx-danger-soft text-nx-danger',     icon: <AlertCircle size={10} aria-hidden="true" /> },
    Pending: { cls: 'border-nx-warning/30 bg-nx-warning-soft text-nx-warning',  icon: <Clock size={10} aria-hidden="true" /> },
  };
  const cfg = map[status] ?? map['Pending'];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
      {cfg.icon}{status}
    </span>
  );
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyShown, setKeyShown] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    customer_type: 'company', name: '', contact_person_name: '', nic_br_number: '', business_type: '', contact_number: '', address: '',
  });
  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleDownload = (id: number, type = '') => {
    const a = document.createElement('a');
    a.href = `${API_BASE}/admin/billing/download?id=${id}${type ? `&type=${type}` : ''}`;
    a.setAttribute('download', '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [subRes, billRes] = await Promise.all([
        adminFetch(`/client/subscription`, {}),
        adminFetch(`/client/billing/history`, {}),
      ]);
      if (subRes.ok) setSubscription((await subRes.json()).data);
      if (billRes.ok) setBillingHistory((await billRes.json()).data || []);
    } catch (err) { console.error(err); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live setup progress polls by itself; when it finishes, reload the page data
  const onSetupFinished = useCallback(() => { void fetchData(true); }, [fetchData]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const startEdit = () => {
    setForm({
      customer_type: subscription?.customer_type === 'solo' ? 'solo' : 'company',
      name: subscription?.name || '',
      contact_person_name: subscription?.contact_person_name || '',
      nic_br_number: subscription?.nic_br_number || '',
      business_type: subscription?.business_type || '',
      contact_number: subscription?.contact_number || '',
      address: subscription?.address || '',
    });
    setProfileMsg(null);
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    setProfileMsg(null);
    try {
      const res = await adminFetch('/client/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Could not save your details.');
      setEditing(false);
      setProfileMsg({ ok: true, text: 'Details updated.' });
      await fetchData(true);
    } catch (e) {
      setProfileMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-[13px] text-nx-text-subtle">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" />
          Loading your workspace…
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl space-y-6">
        <div className="rounded-2xl border border-nx-line bg-white p-8 dark:border-nx-line-dark dark:bg-nx-surface-dark text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-nx-accent/10 text-nx-accent dark:bg-nx-accent-light/20 dark:text-nx-accent-light">
            <Zap size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-nx-ink dark:text-white">Master Administrator Workspace</h2>
            <p className="text-xs text-nx-text-muted dark:text-nx-text-subtle max-w-md mx-auto mt-1">
              You are logged in as a <strong>Platform Super Admin</strong>. Super Admins manage global packages and tenant accounts rather than having an individual client subscription.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a href="/admin/packages" className="rounded-xl bg-nx-accent px-4 py-2 text-xs font-semibold text-white hover:bg-nx-accent-strong transition-colors">Manage Packages</a>
            <a href="/admin/tenants" className="rounded-xl border border-nx-line bg-white px-4 py-2 text-xs font-semibold text-nx-ink hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white transition-colors">View SaaS Tenants</a>
          </div>
        </div>
      </div>
    );
  }

  const s = subscription;
  const status: string = s.status;
  const daysLeft: number | null = s.trial_days_left ?? null;
  const totalDays: number = s.trial_total_days || 14;
  const trialEnded = status === 'Trial' && daysLeft === 0;
  const suspended = status === 'Suspended';
  const ps: string = s.provision_status || 'none';
  const wsReady = ps === 'ready' && !!s.workspace_url && !suspended;

  const cycle: 'monthly' | 'yearly' = s.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
  const monthly = parseFloat(s.monthly_price || '0');
  const price = cycle === 'yearly' ? (s.yearly_price ? parseFloat(s.yearly_price) : monthly * 12) : monthly;
  const priceLabel = `$${price.toFixed(2)} / ${cycle === 'yearly' ? 'year' : 'month'}`;

  const upgradeHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi BizzFlow team, I would like to choose a plan for ${s.name} (${s.slug}).`)}`;
  const supportHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi BizzFlow team, my workspace for ${s.name} (${s.slug}) needs attention.`)}`;

  const hero = suspended
    ? { tone: 'danger', title: 'Your workspace is suspended', text: 'Access is paused. Contact support to restore it.' }
    : trialEnded
      ? { tone: 'danger', title: 'Your trial has ended', text: 'Your data is safe. Choose a plan to keep working.' }
      : status === 'Trial'
        ? { tone: 'info', title: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial`, text: `Full access until ${fmtDate(s.trial_expiry)}. No card needed until then.` }
        : status === 'Active'
          ? { tone: 'success', title: 'Your subscription is active', text: `Next billing date: ${fmtDate(s.next_billing_date)}.` }
          : { tone: 'warning', title: `Subscription ${status.toLowerCase()}`, text: 'Contact us to restore access.' };

  const toneCls: Record<string, string> = {
    info: 'border-nx-info/30 bg-nx-info-soft',
    success: 'border-nx-success/30 bg-nx-success-soft',
    warning: 'border-nx-warning/30 bg-nx-warning-soft',
    danger: 'border-nx-danger/30 bg-nx-danger-soft',
  };
  const usedPct = daysLeft === null ? 0 : Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100));

  const key: string = s.license_key || '';
  const maskedKey = key.length > 14 ? `${key.slice(0, 8)}••••••••${key.slice(-4)}` : key;
  const identityLabel = s.customer_type === 'solo' ? 'NIC number' : 'BR number';

  const steps = [
    { label: 'Account verified', state: 'done' as const },
    { label: 'Creating your workspace', state: ps === 'ready' ? 'done' as const : ps === 'failed' ? 'error' as const : 'active' as const },
    { label: 'Ready to use', state: ps === 'ready' ? 'done' as const : 'todo' as const },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-nx-ink dark:text-white">Your workspace</h1>
          <p className="mt-0.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">{s.name}</p>
        </div>
        <button onClick={() => fetchData()} aria-label="Refresh"
          className="rounded-lg border border-nx-line bg-white p-2 text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark transition-colors">
          <RefreshCcw size={15} />
        </button>
      </div>

      {/* Hero */}
      <section aria-label="Trial status" className={`rounded-xl border p-6 ${toneCls[hero.tone]}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <h2 className="text-xl font-bold text-nx-ink dark:text-white">{hero.title}</h2>
            <p className="text-sm text-nx-text-muted dark:text-nx-text-subtle">{hero.text}</p>
            {status === 'Trial' && !trialEnded && (
              <div className="max-w-md" role="progressbar" aria-label="Trial progress" aria-valuemin={0} aria-valuemax={totalDays} aria-valuenow={totalDays - (daysLeft ?? 0)}>
                <div className="h-2 overflow-hidden rounded-full bg-white/70 dark:bg-nx-line-dark">
                  <div className="h-full rounded-full bg-nx-info motion-safe:transition-all" style={{ width: `${usedPct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-nx-text-muted dark:text-nx-text-subtle">Day {Math.min(totalDays, totalDays - (daysLeft ?? 0))} of {totalDays}</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {wsReady && (
              <a href={s.workspace_url} target="_blank" rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-nx-accent-strong px-5 text-sm font-semibold text-white hover:bg-nx-accent transition-colors">
                <ExternalLink size={15} aria-hidden="true" /> Open ERP workspace
              </a>
            )}
            {!suspended && (
              <a href={upgradeHref} target="_blank" rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-nx-line bg-white px-5 text-sm font-semibold text-nx-ink hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white transition-colors">
                <Rocket size={15} aria-hidden="true" /> {status === 'Active' ? 'Change plan' : 'Choose a plan'}
              </a>
            )}
            {suspended && (
              <a href={supportHref} target="_blank" rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-nx-danger px-5 text-sm font-semibold text-white">
                <MessageCircle size={15} aria-hidden="true" /> Contact support
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Workspace setup + plan */}
      <div className="grid gap-4 lg:grid-cols-2">

        <section aria-label="Workspace setup" className={`${card} p-5`}>
          <p className={eyebrow}>Workspace</p>
          {(ps === 'pending' || ps === 'failed') ? (
            <div className="mt-4"><SetupProgress endpoint="/client/workspace/progress" onFinished={onSetupFinished} /></div>
          ) : (
          <ol className="mt-4 space-y-3">
            {steps.map(st => (
              <li key={st.label} className="flex items-center gap-3 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  st.state === 'done' ? 'bg-nx-success text-white' : st.state === 'error' ? 'bg-nx-danger text-white' : st.state === 'active' ? 'bg-nx-info-soft text-nx-info' : 'bg-nx-surface-muted text-nx-text-subtle dark:bg-nx-line-dark'
                }`}>
                  {st.state === 'done' ? <Check size={13} aria-hidden="true" /> : st.state === 'error' ? <AlertCircle size={13} aria-hidden="true" /> : st.state === 'active' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className={st.state === 'todo' ? 'text-nx-text-subtle' : 'font-medium text-nx-ink dark:text-white'}>{st.label}</span>
              </li>
            ))}
          </ol>
          )}

          {ps === 'failed' && (
            <div className="mt-4 rounded-lg bg-nx-danger-soft p-3 text-xs text-nx-danger">
              <p role="alert" className="flex items-start gap-2">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>Setup hit a problem. Our team has been notified. You can also <a className="font-semibold underline" href={supportHref} target="_blank" rel="noreferrer">message support</a>.</span>
              </p>
              <button
                type="button"
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  setRetryMsg(null);
                  try {
                    const res = await adminFetch('/client/workspace/retry-setup', { method: 'POST' });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) setRetryMsg(json.message || 'Could not restart the setup. Please try again.');
                    else if (json.data?.provision_status === 'failed') setRetryMsg('Setup failed again. Our team has been notified.');
                  } catch {
                    setRetryMsg('Could not reach the server. Please try again.');
                  } finally {
                    setRetrying(false);
                    fetchData(true);
                  }
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-nx-danger px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {retrying ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
                {retrying ? 'Retrying…' : 'Retry setup'}
              </button>
              {retryMsg && <p role="status" className="mt-2">{retryMsg}</p>}
            </div>
          )}

          {s.workspace_url && ps === 'ready' && (
            <div className="mt-5 border-t border-nx-surface-muted pt-4 dark:border-nx-line-dark">
              <p className={`${eyebrow} mb-1.5`}>Address</p>
              <div className="flex items-center gap-2">
                <a href={s.workspace_url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono text-[12px] font-semibold text-nx-accent hover:underline dark:text-nx-accent-light">
                  {String(s.workspace_url).replace(/^https?:\/\//, '')}
                </a>
                <button onClick={() => copy(s.workspace_url, 'url')} aria-label="Copy workspace address" className="rounded-md p-1.5 text-nx-text-subtle hover:bg-nx-surface-muted hover:text-nx-accent dark:hover:bg-nx-line-dark">
                  {copied === 'url' ? <Check size={14} className="text-nx-success" /> : <Copy size={14} />}
                </button>
              </div>
              <WorkspaceAddressChange url={s.workspace_url} onChanged={() => fetchData(true)} />
            </div>
          )}
        </section>

        <section aria-label="Plan and billing" className={`${card} p-5`}>
          <p className={eyebrow}>Plan & billing</p>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <h3 className="text-xl font-bold text-nx-ink dark:text-white">{s.package_name}</h3>
            <span className="rounded-full border border-nx-line px-2 py-0.5 text-[11px] font-medium capitalize text-nx-text-muted dark:border-nx-line-dark dark:text-nx-text-subtle">{cycle}</span>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-nx-text-muted dark:text-nx-text-subtle">{status === 'Trial' ? 'After your trial' : 'Price'}</dt>
              <dd className="font-semibold tabular-nums text-nx-ink dark:text-white">{priceLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-nx-text-muted dark:text-nx-text-subtle">{status === 'Trial' ? 'First billing date' : 'Next billing date'}</dt>
              <dd className="font-semibold text-nx-ink dark:text-white">{fmtDate(s.next_billing_date)}</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-nx-surface-muted pt-4 dark:border-nx-line-dark">
            <p className={`${eyebrow} mb-1.5`}>License key</p>
            <div className="flex items-center gap-1.5">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-nx-line bg-nx-surface-muted px-2.5 py-2 font-mono text-[11px] text-nx-text-muted dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-nx-text-subtle">
                {keyShown ? key : maskedKey}
              </code>
              <button onClick={() => setKeyShown(v => !v)} aria-label={keyShown ? 'Hide license key' : 'Show license key'} className="rounded-md p-2 text-nx-text-subtle hover:bg-nx-surface-muted hover:text-nx-accent dark:hover:bg-nx-line-dark">
                {keyShown ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => copy(key, 'key')} aria-label="Copy license key" className="rounded-md p-2 text-nx-text-subtle hover:bg-nx-surface-muted hover:text-nx-accent dark:hover:bg-nx-line-dark">
                {copied === 'key' ? <Check size={14} className="text-nx-success" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </section>
      </div>

      <CustomDomainCard />

      {/* Account details */}
      <section aria-label="Account details" className={`${card} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-nx-ink dark:text-white">Account details</h3>
          {!editing && (
            <button onClick={startEdit} className="inline-flex items-center gap-1.5 text-xs font-semibold text-nx-accent hover:underline dark:text-nx-accent-light">
              <Pencil size={12} aria-hidden="true" /> Edit details
            </button>
          )}
        </div>

        {!editing ? (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: s.customer_type === 'solo' ? 'Name' : 'Company', value: s.name },
              { label: 'Account type', value: s.customer_type === 'solo' ? 'Solo (individual)' : 'Company' },
              { label: identityLabel, value: s.nic_br_number },
              { label: 'Contact person', value: s.contact_person_name },
              { label: 'Login email', value: s.admin_email },
              { label: 'Business category', value: s.business_type },
              { label: 'Workspace name', value: s.slug },
              { label: 'Phone', value: s.contact_number },
            ].map(item => (
              <div key={item.label} className="min-w-0">
                <dt className={eyebrow}>{item.label}</dt>
                <dd className="mt-1 truncate text-[13px] font-medium text-nx-ink dark:text-white">{item.value || '—'}</dd>
              </div>
            ))}
            <div className="min-w-0 sm:col-span-2 lg:col-span-4">
              <dt className={eyebrow}>Address</dt>
              <dd className="mt-1 text-[13px] font-medium text-nx-ink dark:text-white">{s.address || '—'}</dd>
            </div>
          </dl>
        ) : (
          <form onSubmit={e => { e.preventDefault(); void saveProfile(); }} className="grid gap-4 sm:grid-cols-2">
            {([
              ['edit-type', 'Account type', 'customer_type', 'select'],
              ['edit-name', form.customer_type === 'solo' ? 'Your name' : 'Company name', 'name', 'text'],
              ['edit-identity', form.customer_type === 'solo' ? 'NIC number' : 'BR number', 'nic_br_number', 'text'],
              ['edit-contact', 'Contact person', 'contact_person_name', 'text'],
              ['edit-category', 'Business category', 'business_type', 'category'],
              ['edit-phone', 'Phone', 'contact_number', 'tel'],
            ] as const).map(([id, label, key, kind]) => (
              <div key={id} className="space-y-1.5">
                <label htmlFor={id} className="block text-xs font-semibold text-nx-text-muted dark:text-nx-text-subtle">{label}</label>
                {kind === 'category' ? (
                  <select id={id} value={form.business_type} onChange={setField('business_type')} className={inputCls}>
                    <option value="">Select…</option>
                    {form.business_type && !(BUSINESS_TYPES as readonly string[]).includes(form.business_type) && (
                      <option value={form.business_type}>{form.business_type}</option>
                    )}
                    {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : kind === 'select' ? (
                  <select id={id} value={form[key]} onChange={setField(key)} className={inputCls}>
                    <option value="company">Company</option>
                    <option value="solo">Solo (individual)</option>
                  </select>
                ) : (
                  <input id={id} type={kind} value={form[key]} onChange={setField(key)} className={inputCls} autoComplete={kind === 'tel' ? 'tel' : 'off'} />
                )}
              </div>
            ))}
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="edit-address" className="block text-xs font-semibold text-nx-text-muted dark:text-nx-text-subtle">Address</label>
              <textarea id="edit-address" rows={2} value={form.address} onChange={setField('address')} autoComplete="street-address"
                className="w-full rounded-xl border border-nx-line bg-white px-3.5 py-2.5 text-sm text-nx-ink focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20 dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-white" />
            </div>
            <p className="text-[11px] text-nx-text-subtle sm:col-span-2">
              Login email ({s.admin_email}) and workspace name ({s.slug}) are tied to your sign-in and workspace address, so they change only after an identity check. Contact support to change them.
            </p>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-nx-accent-strong px-5 text-sm font-semibold text-white hover:bg-nx-accent disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Save changes
              </button>
              <button type="button" onClick={() => setEditing(false)} disabled={saving}
                className="inline-flex h-10 items-center rounded-xl border border-nx-line px-5 text-sm font-semibold text-nx-ink dark:border-nx-line-dark dark:text-white">Cancel</button>
            </div>
          </form>
        )}
        {profileMsg && (
          <p role={profileMsg.ok ? 'status' : 'alert'} className={`mt-4 text-xs font-medium ${profileMsg.ok ? 'text-nx-success' : 'text-nx-danger'}`}>{profileMsg.text}</p>
        )}
      </section>

      {/* Invoices */}
      <section aria-label="Invoices" className={`overflow-hidden ${card}`}>
        <div className="flex items-center justify-between border-b border-nx-line px-5 py-3.5 dark:border-nx-line-dark">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-nx-accent dark:text-nx-accent-light" aria-hidden="true" />
            <h3 className="text-[13px] font-semibold text-nx-ink dark:text-white">Invoices</h3>
          </div>
          <span className="text-[12px] text-nx-text-subtle dark:text-nx-text-strong">{billingHistory.length} {billingHistory.length === 1 ? 'record' : 'records'}</span>
        </div>
        {billingHistory.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-nx-ink dark:text-white">No invoices yet</p>
            <p className="mt-1 text-xs text-nx-text-subtle">
              {status === 'Trial' ? `Your first invoice is created when your trial ends on ${fmtDate(s.trial_expiry)}.` : 'Invoices appear here after each billing cycle.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-nx-line bg-nx-surface-soft dark:border-nx-line-dark dark:bg-nx-surface-dark">
                  {['Invoice', 'Period', 'Amount', 'Due date', 'Status', ''].map((h, i) => (
                    <th key={i} scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle">{h || <span className="sr-only">Actions</span>}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-nx-surface-muted dark:divide-nx-line-dark">
                {billingHistory.map(inv => (
                  <tr key={inv.id} className="hover:bg-nx-surface-soft dark:hover:bg-nx-surface-dark-2 transition-colors">
                    <td className="px-5 py-3.5"><code className="font-mono text-[12px] font-semibold text-nx-accent dark:text-nx-accent-light">{inv.invoice_number}</code></td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-nx-ink dark:text-white">{inv.billing_month}</td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold tabular-nums text-nx-ink dark:text-white">${inv.amount}</td>
                    <td className="px-5 py-3.5 text-[13px] text-nx-text-muted dark:text-nx-text-subtle">{fmtDate(inv.due_date)}</td>
                    <td className="px-5 py-3.5"><InvoiceStatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleDownload(inv.id, 'invoice')} aria-label={`Download invoice ${inv.invoice_number}`} className="rounded-md p-2 text-nx-text-subtle hover:bg-nx-surface-muted hover:text-nx-accent dark:hover:bg-nx-line-dark transition-colors">
                          <FileText size={15} />
                        </button>
                        {inv.status === 'Paid' && (
                          <button onClick={() => handleDownload(inv.id, 'receipt')} aria-label={`Download receipt for ${inv.invoice_number}`} className="rounded-md p-2 text-nx-text-subtle hover:bg-nx-success-soft hover:text-nx-success transition-colors">
                            <Download size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
