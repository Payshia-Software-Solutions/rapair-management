"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Phone, MessageCircle, Check, Building2, User, Eye, EyeOff, Pencil, ShieldCheck, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BUSINESS_TYPES } from '@/lib/businessTypes';

const STEPS = ['Plan', 'Details', 'Account', 'Review'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIC_RE = /^(\d{9}[VvXx]|\d{12})$/;
const DRAFT_KEY = 'bizzflow-order-draft';

type Form = {
  company_name: string;
  contact_person: string;
  nic_br_number: string;
  business_type: string;
  contact_number: string;
  address: string;
  email: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
};
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = {
  company_name: '', contact_person: '', nic_br_number: '', business_type: BUSINESS_TYPES[0],
  contact_number: '', address: '', email: '', password: '', confirm_password: '', accept_terms: false,
};

const inputCls = (invalid: boolean) => `
  w-full h-11 rounded-xl border bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400
  focus:outline-none focus:ring-2 motion-safe:transition-colors
  dark:bg-slate-900 dark:text-white
  ${invalid
    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500/60'
    : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-600/20 dark:border-slate-700 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20'}
`;

function Field({ id, label, required = false, error, hint, children }: {
  id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-red-600" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertCircle size={12} aria-hidden="true" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function passwordStrength(p: string): { score: number; label: string } {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) score++;
  return { score, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][p.length === 0 ? 0 : Math.max(score, 1)] };
}

function OrderContent() {
  const searchParams = useSearchParams();
  const initialPkgId = searchParams.get('package') || '1';
  const initialCycle = searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly';

  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);

  const [serverPackages, setServerPackages] = useState<any[]>([]);
  const [annualDiscount, setAnnualDiscount] = useState<number>(20);
  const [selectedPkgId, setSelectedPkgId] = useState<string>(initialPkgId);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(initialCycle);
  const [customerType, setCustomerType] = useState<'company' | 'solo'>('company');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    fetch(`${API_BASE}/saas/packages`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          const filtered = data.data.filter((p: any) =>
            Number(p.is_public) === 1 && p.package_key !== 'free_trial' && p.package_key !== 'custom'
          );
          setServerPackages(filtered);
          if (data.annual_discount_percentage) setAnnualDiscount(parseFloat(data.annual_discount_percentage));
          if (!filtered.some((p: any) => String(p.id) === String(initialPkgId)) && filtered.length > 0) {
            setSelectedPkgId(String(filtered[0].id));
          }
        }
      })
      .catch(err => console.error('Failed to load packages', err));
  }, [initialPkgId]);

  // Restore a saved draft (never the passwords) after a refresh.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setForm(f => ({ ...f, ...d.form, password: '', confirm_password: '', accept_terms: false }));
        if (d.customerType) setCustomerType(d.customerType);
        if (d.billingCycle) setBillingCycle(d.billingCycle);
        if (d.pkg && !searchParams.get('package')) setSelectedPkgId(d.pkg);
        if (typeof d.step === 'number') { setStep(Math.min(d.step, 2)); setMaxStep(Math.min(d.step, 2)); }
      }
    } catch { /* ignore a corrupt draft */ }
    restored.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!restored.current || registeredEmail) return;
    const { password, confirm_password, accept_terms, ...safe } = form;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: safe, customerType, billingCycle, pkg: selectedPkgId, step }));
  }, [form, customerType, billingCycle, selectedPkgId, step, registeredEmail]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => { headingRef.current?.focus(); }, [step, registeredEmail]);

  const currentPkg = serverPackages.find(p => String(p.id) === String(selectedPkgId)) || serverPackages[0];
  const priceOf = (p: any, cycle: 'monthly' | 'yearly') => {
    const monthly = parseFloat(p?.monthly_price || '0');
    return cycle === 'yearly'
      ? (p?.yearly_price ? parseFloat(p.yearly_price) : monthly * 12 * ((100 - annualDiscount) / 100))
      : monthly;
  };
  const priceText = (p: any, cycle: 'monthly' | 'yearly') =>
    p ? `$${priceOf(p, cycle).toFixed(0)} / ${cycle === 'yearly' ? 'year' : 'month'}` : '—';
  const modulesOf = (p: any): string[] => {
    try {
      const m = typeof p.modules === 'string' ? JSON.parse(p.modules) : p.modules;
      return Array.isArray(m) ? m.filter((x: any) => typeof x === 'string').slice(0, 3) : [];
    } catch { return []; }
  };

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    if (key === 'email') setEmailTaken(false);
  };

  const fieldError = (key: keyof Form, f: Form = form): string | undefined => {
    switch (key) {
      case 'company_name':
        return customerType === 'company' && !f.company_name.trim() ? 'Enter your company name.' : undefined;
      case 'contact_person':
        return !f.contact_person.trim() ? (customerType === 'company' ? 'Enter the contact person.' : 'Enter your full name.') : undefined;
      case 'nic_br_number': {
        const v = f.nic_br_number.trim();
        if (customerType === 'company') return v.length < 5 ? 'Enter a valid BR number (at least 5 characters).' : undefined;
        return NIC_RE.test(v) ? undefined : 'Enter a valid NIC: 9 digits and V, or 12 digits.';
      }
      case 'email':
        if (!EMAIL_RE.test(f.email.trim())) return 'Enter a valid work email, like name@company.com.';
        return emailTaken ? 'This email is already registered.' : undefined;
      case 'password':
        return f.password.length < 8 ? 'Use at least 8 characters.' : undefined;
      case 'confirm_password':
        return f.password !== f.confirm_password ? 'Passwords do not match.' : undefined;
      case 'accept_terms':
        return f.accept_terms ? undefined : 'Please accept the terms to continue.';
      default:
        return undefined;
    }
  };

  const STEP_FIELDS: Record<number, (keyof Form)[]> = {
    1: ['company_name', 'contact_person', 'nic_br_number'],
    2: ['email', 'password', 'confirm_password', 'accept_terms'],
  };

  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (serverPackages.length === 0) { setFormError('Plans are still loading. Please wait a moment.'); return false; }
      setFormError(null);
      return true;
    }
    const next: Errors = {};
    for (const key of STEP_FIELDS[s] ?? []) {
      const msg = fieldError(key);
      if (msg) next[key] = msg;
    }
    setErrors(e => ({ ...e, ...next }));
    const first = Object.keys(next)[0];
    if (first) {
      setFormError(null);
      requestAnimationFrame(() => document.getElementById(`f-${first}`)?.focus());
      return false;
    }
    return true;
  };

  const blurField = (key: keyof Form) => {
    const msg = fieldError(key);
    setErrors(e => ({ ...e, [key]: msg }));
  };

  const checkEmail = async () => {
    const email = form.email.trim();
    if (!EMAIL_RE.test(email)) { blurField('email'); return; }
    try {
      const res = await fetch(`${API_BASE}/auth/check-email?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const taken = data.status === 'success' && data.available === false;
      setEmailTaken(taken);
      setErrors(e => ({ ...e, email: taken ? 'This email is already registered.' : undefined }));
    } catch { /* the server re-checks on submit */ }
  };

  const goTo = (target: number) => {
    if (target > step && !validateStep(step)) return;
    const clamped = Math.min(target, 3);
    setStep(clamped);
    setMaxStep(m => Math.max(m, clamped));
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2)) { setStep(!validateStep(1) ? 1 : 2); return; }
    setIsSubmitting(true);
    setFormError(null);
    const payload = {
      customer_type: customerType,
      company_name: customerType === 'company' ? form.company_name.trim() : form.contact_person.trim(),
      contact_person: form.contact_person.trim(),
      nic_br_number: form.nic_br_number.trim(),
      business_type: form.business_type,
      address: form.address.trim(),
      email: form.email.trim().toLowerCase(),
      contact_number: form.contact_number.trim(),
      password: form.password,
      confirm_password: form.confirm_password,
      accept_terms: form.accept_terms,
      package_id: selectedPkgId,
      billing_cycle: billingCycle,
    };
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok) {
        sessionStorage.removeItem(DRAFT_KEY);
        setRegisteredEmail(payload.email);
        setResendIn(60);
      } else if (/terms/i.test(result.message || '')) {
        setErrors(e => ({ ...e, accept_terms: 'Please accept the terms to continue.' }));
        setStep(2);
      } else if (response.status === 409 && /email/i.test(result.message || '')) {
        setEmailTaken(true);
        setErrors(e => ({ ...e, email: 'This email is already registered.' }));
        setStep(2);
      } else {
        setFormError(result.message || 'Registration failed. Please check your details and try again.');
      }
    } catch {
      setFormError('Cannot reach the server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = async () => {
    if (!registeredEmail || resendIn > 0) return;
    setResendNote(null);
    try {
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail }),
      });
      const data = await res.json();
      setResendNote(data.message || 'A new link is on its way.');
    } catch {
      setResendNote('Could not resend right now. Try again in a minute.');
    }
    setResendIn(60);
  };

  const strength = passwordStrength(form.password);
  const identityLabel = customerType === 'company' ? 'BR number' : 'NIC number';

  const describe = (key: keyof Form) => (errors[key] || key === 'password' || key === 'nic_br_number' ? { 'aria-describedby': `f-${key}-msg` } : {});

  const SummaryBody = (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Plan</dt><dd className="font-semibold text-slate-900 dark:text-white">{currentPkg?.name ?? '—'}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Billing</dt><dd className="font-semibold capitalize text-slate-900 dark:text-white">{billingCycle}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Due today</dt><dd className="font-bold text-emerald-600 dark:text-emerald-400">$0</dd></div>
      <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
        <dt className="text-slate-500 dark:text-slate-400">After 14-day trial</dt>
        <dd className="font-bold tabular-nums text-slate-900 dark:text-white">{priceText(currentPkg, billingCycle)}</dd>
      </div>
    </dl>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 pt-28 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">

        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Start your 14-day free trial</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">No credit card. Your workspace is ready minutes after you verify your email.</p>
        </div>

        {registeredEmail ? (
          <div className="mx-auto max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 size={28} aria-hidden="true" />
            </div>
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-black outline-none">Check your inbox</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              We sent a verification link to <strong className="text-slate-900 dark:text-white">{registeredEmail}</strong>.
              Click it to start your trial workspace.
            </p>
            <div className="space-y-2" aria-live="polite">
              <button type="button" onClick={resend} disabled={resendIn > 0}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                {resendIn > 0 ? `Resend email in ${resendIn}s` : 'Resend email'}
              </button>
              {resendNote && <p className="text-xs text-slate-500 dark:text-slate-400">{resendNote}</p>}
            </div>
            <button type="button" onClick={() => { setRegisteredEmail(null); setStep(2); setMaxStep(3); }}
              className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
              Wrong email? Go back and change it
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

            {/* Mobile summary */}
            <details open={summaryOpen} onToggle={(e) => setSummaryOpen((e.target as HTMLDetailsElement).open)}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                <span>{currentPkg?.name ?? 'Plan'} · {priceText(currentPkg, billingCycle)}</span>
                <ChevronDown size={16} aria-hidden="true" className={summaryOpen ? 'rotate-180' : ''} />
              </summary>
              <div className="mt-4">{SummaryBody}</div>
            </details>

            {/* Wizard */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">

              <nav aria-label="Sign-up progress" className="mb-8">
                <p className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:hidden">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 sm:hidden" role="presentation">
                  <div className="h-full rounded-full bg-indigo-600 motion-safe:transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
                </div>
                <ol className="hidden items-center gap-2 sm:flex">
                  {STEPS.map((label, i) => {
                    const reachable = i <= maxStep;
                    return (
                      <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
                        <button type="button" disabled={!reachable} onClick={() => goTo(i)}
                          aria-current={i === step ? 'step' : undefined}
                          className="flex items-center gap-2 rounded-lg py-1 text-left disabled:cursor-not-allowed">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            i < step ? 'bg-emerald-600 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {i < step ? <Check size={14} aria-hidden="true" /> : i + 1}
                          </span>
                          <span className={`text-xs font-semibold ${i === step ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
                        </button>
                        {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div key={step} className="space-y-6 motion-safe:animate-[fadeIn_200ms_ease-out]">

                {/* Step 1: Plan */}
                {step === 0 && (
                  <>
                    <div>
                      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">Choose your plan</h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Who will use this workspace?</p>
                    </div>

                    <div role="radiogroup" aria-label="Account type" className="grid gap-3 sm:grid-cols-2">
                      {([
                        { v: 'company', title: 'Company', text: 'A registered business with a BR number', Icon: Building2 },
                        { v: 'solo', title: 'Solo', text: 'An individual, identified by NIC', Icon: User },
                      ] as const).map(({ v, title, text, Icon }) => (
                        <button key={v} type="button" role="radio" aria-checked={customerType === v} onClick={() => setCustomerType(v)}
                          className={`flex items-start gap-3 rounded-xl border p-4 text-left motion-safe:transition-colors ${
                            customerType === v ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                          }`}>
                          <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            <span className="block text-sm font-bold">{title}</span>
                            <span className="block text-xs text-slate-600 dark:text-slate-400">{text}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-center">
                      <div role="radiogroup" aria-label="Billing cycle" className="inline-flex rounded-xl border border-slate-300 p-1 dark:border-slate-700">
                        {(['monthly', 'yearly'] as const).map((c) => (
                          <button key={c} type="button" role="radio" aria-checked={billingCycle === c} onClick={() => setBillingCycle(c)}
                            className={`h-9 rounded-lg px-4 text-xs font-bold ${billingCycle === c ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>
                            {c === 'monthly' ? 'Monthly' : `Annual · save ${annualDiscount}%`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
                      {serverPackages.length === 0 && (
                        <>
                          <div className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                          <div className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                        </>
                      )}
                      {serverPackages.map((p) => {
                        const on = String(p.id) === String(selectedPkgId);
                        return (
                          <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setSelectedPkgId(String(p.id))}
                            className={`relative rounded-xl border p-4 text-left motion-safe:transition-colors ${
                              on ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                            }`}>
                            {on && <Check size={16} aria-hidden="true" className="absolute right-3 top-3 text-indigo-600 dark:text-indigo-400" />}
                            <span className="block text-sm font-bold">{p.name}</span>
                            <span className="mt-1 block text-lg font-black tabular-nums">{priceText(p, billingCycle)}</span>
                            {modulesOf(p).length > 0 && (
                              <span className="mt-2 block text-xs text-slate-600 dark:text-slate-400">{modulesOf(p).join(' · ')}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Step 2: Details */}
                {step === 1 && (
                  <>
                    <div>
                      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">{customerType === 'company' ? 'Business details' : 'Your details'}</h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Used to set up your workspace and invoices.</p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {customerType === 'company' && (
                        <Field id="f-company_name" label="Company name" required error={errors.company_name}>
                          <input id="f-company_name" className={inputCls(!!errors.company_name)} value={form.company_name} autoComplete="organization"
                            onChange={(e) => update('company_name', e.target.value)} onBlur={() => blurField('company_name')}
                            aria-invalid={!!errors.company_name} {...describe('company_name')} placeholder="Acme Trading (Pvt) Ltd" />
                        </Field>
                      )}
                      <Field id="f-contact_person" label={customerType === 'company' ? 'Contact person' : 'Full name'} required error={errors.contact_person}>
                        <input id="f-contact_person" className={inputCls(!!errors.contact_person)} value={form.contact_person} autoComplete="name"
                          onChange={(e) => update('contact_person', e.target.value)} onBlur={() => blurField('contact_person')}
                          aria-invalid={!!errors.contact_person} {...describe('contact_person')} placeholder="Alex Rivera" />
                      </Field>
                      <Field id="f-nic_br_number" label={identityLabel} required error={errors.nic_br_number}
                        hint={customerType === 'company' ? 'Business registration number, for example PV 12345.' : 'For example 199012345678 or 901234567V.'}>
                        <input id="f-nic_br_number" className={inputCls(!!errors.nic_br_number)} value={form.nic_br_number} autoComplete="off"
                          onChange={(e) => update('nic_br_number', e.target.value)} onBlur={() => blurField('nic_br_number')}
                          aria-invalid={!!errors.nic_br_number} {...describe('nic_br_number')} />
                      </Field>
                      <Field id="f-business_type" label="Business category">
                        <select id="f-business_type" className={`${inputCls(false)} cursor-pointer`} value={form.business_type}
                          onChange={(e) => update('business_type', e.target.value)}>
                          {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </Field>
                      <Field id="f-contact_number" label="Phone">
                        <input id="f-contact_number" type="tel" inputMode="tel" className={inputCls(false)} value={form.contact_number} autoComplete="tel"
                          onChange={(e) => update('contact_number', e.target.value)} placeholder="+94 77 123 4567" />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field id="f-address" label="Address">
                          <textarea id="f-address" rows={2} className={`${inputCls(false)} h-auto min-h-[72px] py-2.5`} value={form.address} autoComplete="street-address"
                            onChange={(e) => update('address', e.target.value)} placeholder="123 Innovation Way, Colombo" />
                        </Field>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 3: Account */}
                {step === 2 && (
                  <>
                    <div>
                      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">Create your login</h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">We send the verification link to this email.</p>
                    </div>
                    <div className="space-y-5">
                      <Field id="f-email" label="Work email" required error={errors.email}>
                        <input id="f-email" type="email" inputMode="email" className={inputCls(!!errors.email)} value={form.email} autoComplete="email"
                          onChange={(e) => update('email', e.target.value)} onBlur={checkEmail}
                          aria-invalid={!!errors.email} {...describe('email')} placeholder="alex@acme.com" />
                        {emailTaken && (
                          <Link href="/admin/login" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">Sign in instead</Link>
                        )}
                      </Field>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field id="f-password" label="Password" required error={errors.password} hint="At least 8 characters.">
                          <div className="relative">
                            <input id="f-password" type={showPassword ? 'text' : 'password'} className={`${inputCls(!!errors.password)} pr-11`} value={form.password}
                              autoComplete="new-password" onChange={(e) => update('password', e.target.value)} onBlur={() => blurField('password')}
                              aria-invalid={!!errors.password} {...describe('password')} />
                            <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white">
                              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                            </button>
                          </div>
                          {form.password && (
                            <div className="flex items-center gap-2" aria-live="polite">
                              <div className="flex flex-1 gap-1" aria-hidden="true">
                                {[1, 2, 3, 4].map(n => (
                                  <span key={n} className={`h-1 flex-1 rounded-full ${strength.score >= n ? (strength.score <= 1 ? 'bg-red-500' : strength.score === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200 dark:bg-slate-700'}`} />
                                ))}
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-400">{strength.label}</span>
                            </div>
                          )}
                        </Field>
                        <Field id="f-confirm_password" label="Confirm password" required error={errors.confirm_password}>
                          <input id="f-confirm_password" type={showPassword ? 'text' : 'password'} className={inputCls(!!errors.confirm_password)} value={form.confirm_password}
                            autoComplete="new-password" onChange={(e) => update('confirm_password', e.target.value)} onBlur={() => blurField('confirm_password')}
                            aria-invalid={!!errors.confirm_password} {...describe('confirm_password')} />
                        </Field>
                      </div>
                      <div>
                        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                          <input id="f-accept_terms" type="checkbox" checked={form.accept_terms} onChange={(e) => update('accept_terms', e.target.checked)}
                            aria-invalid={!!errors.accept_terms} {...describe('accept_terms')}
                            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-600/40" />
                          <span>I agree to the Terms of Service and Privacy Policy.</span>
                        </label>
                        {errors.accept_terms && (
                          <p id="f-accept_terms-msg" role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                            <AlertCircle size={12} aria-hidden="true" /> {errors.accept_terms}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Step 4: Review */}
                {step === 3 && (
                  <>
                    <div>
                      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">Review and create</h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Check everything. Use Edit to change a section.</p>
                    </div>
                    {([
                      { title: 'Plan', target: 0, rows: [
                        ['Type', customerType === 'company' ? 'Company' : 'Solo'],
                        ['Plan', currentPkg?.name ?? '—'],
                        ['Billing', `${billingCycle === 'yearly' ? 'Annual' : 'Monthly'} · ${priceText(currentPkg, billingCycle)} after trial`],
                      ] },
                      { title: customerType === 'company' ? 'Business' : 'Personal', target: 1, rows: [
                        ...(customerType === 'company' ? [['Company', form.company_name]] : []),
                        [customerType === 'company' ? 'Contact person' : 'Name', form.contact_person],
                        [identityLabel, form.nic_br_number],
                        ['Category', form.business_type],
                        ['Phone', form.contact_number || '—'],
                        ['Address', form.address || '—'],
                      ] },
                      { title: 'Login', target: 2, rows: [['Email', form.email]] },
                    ] as { title: string; target: number; rows: string[][] }[]).map(section => (
                      <section key={section.title} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{section.title}</h3>
                          <button type="button" onClick={() => goTo(section.target)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                            <Pencil size={12} aria-hidden="true" /> Edit<span className="sr-only"> {section.title}</span>
                          </button>
                        </div>
                        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                          {section.rows.map(([k, v]) => (
                            <div key={k}>
                              <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
                              <dd className="break-words font-semibold">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    ))}
                    <p className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <ShieldCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600" />
                      Your 14-day trial starts after you verify your email. Nothing is charged today.
                    </p>
                  </>
                )}
              </div>

              {formError && (
                <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <p className="font-medium">{formError}</p>
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0 || isSubmitting}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:invisible dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={() => goTo(step + 1)}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                    Continue <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={isSubmitting}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
                    {isSubmitting ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Creating workspace…</> : <>Create my workspace <ArrowRight size={16} aria-hidden="true" /></>}
                  </button>
                )}
              </div>
            </div>

            {/* Desktop summary */}
            <aside className="hidden lg:block">
              <div className="sticky top-28 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-sm font-bold">Your order</h2>
                  {SummaryBody}
                  <ul className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    {['No credit card required', 'Cancel any time', 'Workspace ready in minutes'].map(t => (
                      <li key={t} className="flex items-center gap-2"><Check size={13} aria-hidden="true" className="text-emerald-600" />{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-bold">Need help choosing?</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Talk to our consultants.</p>
                  <div className="mt-3 flex gap-2">
                    <a href="https://wa.me/94770481363?text=Hi%20BizzFlow%20Team%2C%20I%20would%20like%20assistance%20with%20deploying%20my%20ERP%20workspace."
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800">
                      <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                    </a>
                    <a href="tel:+94770481363"
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                      <Phone size={13} aria-hidden="true" /> Call
                    </a>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" /> Loading checkout…
        </div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}
