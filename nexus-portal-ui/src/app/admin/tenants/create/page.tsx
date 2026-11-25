"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Plus, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { adminFetch, inputCls, cardCls } from '@/lib/adminApi';
import { BUSINESS_TYPES } from '@/lib/businessTypes';

type Pkg = { id: number | string; name: string; monthly_price?: number | string; yearly_price?: number | string; package_key?: string };
type Form = {
  name: string;
  slug: string;
  admin_email: string;
  business_type: string;
  contact_number: string;
  address: string;
  package_id: string;
  billing_cycle: 'monthly' | 'yearly';
  currency: string;
  status: 'Trial' | 'Active';
  trial_days: number;
  billing_cc_email: string;
};

const CURRENCIES = ['USD', 'LKR', 'EUR', 'GBP'];
const RESERVED = ['www', 'api', 'admin', 'app', 'mail', 'static', 'login', 'nexus'];
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = 'Company name is required.';
  if (!SLUG_RE.test(f.slug)) e.slug = '3–63 characters: lowercase letters, digits and hyphens.';
  else if (RESERVED.includes(f.slug)) e.slug = 'This slug is reserved.';
  if (!EMAIL_RE.test(f.admin_email.trim())) e.admin_email = 'Enter a valid administrative email.';
  if (f.billing_cc_email.trim()) {
    const bad = f.billing_cc_email.split(',').map(s => s.trim()).find(s => !EMAIL_RE.test(s));
    if (bad) e.billing_cc_email = `Invalid address: ${bad}`;
  }
  if (!f.package_id) e.package_id = 'Choose a subscription package.';
  if (f.status === 'Trial' && (f.trial_days < 1 || f.trial_days > 90)) e.trial_days = 'Trial length must be 1–90 days.';
  return e;
}

const Field = ({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-bold uppercase tracking-wider text-nx-text-muted dark:text-nx-text-subtle">{label}</label>
    {children}
    {error ? (
      <p role="alert" className="flex items-center gap-1 text-[11px] font-medium text-nx-danger"><AlertCircle size={12} />{error}</p>
    ) : hint ? (
      <p className="text-[11px] text-nx-text-subtle">{hint}</p>
    ) : null}
  </div>
);

export default function TenantCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<Form>({
    name: '', slug: '', admin_email: '', business_type: '', contact_number: '', address: '',
    package_id: '', billing_cycle: 'monthly', currency: 'USD', status: 'Trial', trial_days: 14, billing_cc_email: '',
  });

  useEffect(() => {
    adminFetch('/admin/packages')
      .then(r => r.json())
      .then(d => {
        const list: Pkg[] = (d.data || []).filter((p: Pkg) => p.package_key !== 'free_trial');
        setPackages(list);
        if (list[0]) setForm(f => ({ ...f, package_id: f.package_id || String(list[0].id) }));
      })
      .catch(() => setServerError('Could not load packages. Refresh the page.'));
  }, []);

  const errors = useMemo(() => (touched ? validate(form) : {}), [form, touched]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const selectedPkg = packages.find(p => String(p.id) === form.package_id);
  const price = selectedPkg ? Number(form.billing_cycle === 'yearly' ? selectedPkg.yearly_price : selectedPkg.monthly_price) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (Object.keys(validate(form)).length) return;
    setSaving(true);
    try {
      const res = await adminFetch('/admin/tenants/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          slug: form.slug.trim(),
          admin_email: form.admin_email.trim().toLowerCase(),
          billing_cc_email: form.billing_cc_email.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'success') {
        setServerError(data.message || `Registration failed (${res.status}).`);
        return;
      }
      router.push('/admin/tenants');
    } catch {
      setServerError('Cannot reach the server. Check the API and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6 p-4 pb-24 sm:p-8">
      <div className="space-y-2 border-b border-nx-line pb-5 dark:border-nx-line-dark">
        <button onClick={() => router.push('/admin/tenants')} className="flex items-center gap-1 text-xs font-semibold text-nx-text-muted hover:text-nx-accent dark:text-nx-text-subtle">
          <ChevronLeft size={15} /> Back to tenants
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-nx-ink dark:text-white">Register a tenant</h1>
        <p className="text-sm text-nx-text-muted dark:text-nx-text-subtle">Create the workspace record, its license and API key, and the first billing setup.</p>
      </div>

      {serverError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-nx-danger/30 bg-nx-danger-soft p-4 text-sm text-nx-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className={`${cardCls} space-y-5 p-6`}>
            <h2 className="text-sm font-semibold text-nx-ink dark:text-white">Company</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Company name" error={errors.name}>
                <input className={inputCls} value={form.name} placeholder="Acme Trading (Pvt) Ltd"
                  onChange={e => {
                    const name = e.target.value;
                    setForm(f => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                  }} />
              </Field>
              <Field label="Workspace slug" error={errors.slug} hint="Used in the workspace address. Cannot be changed once customers log in.">
                <input className={`${inputCls} font-mono`} value={form.slug} placeholder="acme-trading"
                  onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
              </Field>
              <Field label="Business type">
                <select className={inputCls} value={form.business_type} onChange={e => set('business_type', e.target.value)}>
                  <option value="">Select…</option>
                  {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Contact number">
                <input className={inputCls} value={form.contact_number} placeholder="+94 77 123 4567" onChange={e => set('contact_number', e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <textarea className={`${inputCls} min-h-[72px]`} value={form.address} onChange={e => set('address', e.target.value)} />
                </Field>
              </div>
            </div>
          </section>

          <section className={`${cardCls} space-y-5 p-6`}>
            <h2 className="text-sm font-semibold text-nx-ink dark:text-white">Contacts & billing</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Administrator email" error={errors.admin_email} hint="Receives the login invitation and account notices.">
                <input type="email" className={inputCls} value={form.admin_email} placeholder="owner@acme.lk" onChange={e => set('admin_email', e.target.value)} />
              </Field>
              <Field label="Billing CC emails" error={errors.billing_cc_email} hint="Optional. Separate several with commas.">
                <input className={inputCls} value={form.billing_cc_email} placeholder="accounts@acme.lk" onChange={e => set('billing_cc_email', e.target.value)} />
              </Field>
              <Field label="Billing currency">
                <select className={inputCls} value={form.currency} onChange={e => set('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Billing cycle">
                <select className={inputCls} value={form.billing_cycle} onChange={e => set('billing_cycle', e.target.value as Form['billing_cycle'])}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
            </div>
          </section>

          <section className={`${cardCls} space-y-5 p-6`}>
            <h2 className="text-sm font-semibold text-nx-ink dark:text-white">Plan & starting status</h2>
            <Field label="Subscription package" error={errors.package_id}>
              <select className={inputCls} value={form.package_id} onChange={e => set('package_id', e.target.value)}>
                {packages.length === 0 && <option value="">Loading packages…</option>}
                {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { v: 'Trial', icon: Clock, title: 'Start on trial', text: 'Full access until the trial ends. After that, changes are locked until a plan is chosen.', tone: 'text-nx-info' },
                { v: 'Active', icon: Zap, title: 'Start active', text: 'Paid from day one. The renewal date is set one billing cycle ahead.', tone: 'text-nx-success' },
              ] as const).map(opt => {
                const on = form.status === opt.v;
                return (
                  <button type="button" key={opt.v} onClick={() => set('status', opt.v)} aria-pressed={on}
                    className={`rounded-xl border p-4 text-left transition-colors ${on ? `border-nx-accent bg-nx-accent-soft` : 'border-nx-line hover:bg-nx-surface-soft dark:border-nx-line-dark dark:hover:bg-nx-surface-dark-2'}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-nx-ink dark:text-white"><opt.icon size={15} className={opt.tone} />{opt.title}</div>
                    <p className="mt-1 text-xs text-nx-text-muted dark:text-nx-text-subtle">{opt.text}</p>
                  </button>
                );
              })}
            </div>
            {form.status === 'Trial' && (
              <Field label="Trial length (days)" error={errors.trial_days}>
                <input type="number" min={1} max={90} className={`${inputCls} max-w-[160px]`} value={form.trial_days}
                  onChange={e => set('trial_days', Number(e.target.value))} />
              </Field>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <section className={`${cardCls} sticky top-6 space-y-4 p-6`}>
            <h2 className="text-sm font-semibold text-nx-ink dark:text-white">Summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-nx-text-muted dark:text-nx-text-subtle">Plan</dt><dd className="font-medium text-nx-ink dark:text-white">{selectedPkg?.name ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-nx-text-muted dark:text-nx-text-subtle">Price</dt><dd className="font-medium text-nx-ink dark:text-white">{price > 0 ? `${form.currency} ${price.toLocaleString()} / ${form.billing_cycle === 'yearly' ? 'year' : 'month'}` : 'Custom'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-nx-text-muted dark:text-nx-text-subtle">Starts as</dt><dd className="font-medium text-nx-ink dark:text-white">{form.status === 'Trial' ? `Trial · ${form.trial_days} days` : 'Active'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-nx-text-muted dark:text-nx-text-subtle">Workspace</dt><dd className="font-mono text-xs text-nx-ink dark:text-white">{form.slug || '—'}</dd></div>
            </dl>
            <p className="rounded-lg bg-nx-surface-muted p-3 text-xs text-nx-text-muted dark:bg-nx-line-dark dark:text-nx-text-subtle">
              A license key and API key are generated on save. The administrator can sign in after the workspace is provisioned.
            </p>
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-nx-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-nx-accent disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Register tenant
            </button>
            <button type="button" onClick={() => router.push('/admin/tenants')} className="w-full rounded-xl border border-nx-line px-5 py-2.5 text-sm font-medium text-nx-ink hover:bg-nx-surface-soft dark:border-nx-line-dark dark:text-white dark:hover:bg-nx-surface-dark-2">
              Cancel
            </button>
          </section>
        </aside>
      </form>
    </div>
  );
}
