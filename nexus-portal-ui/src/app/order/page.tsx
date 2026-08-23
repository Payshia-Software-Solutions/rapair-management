"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect, Suspense } from 'react';
import { ShieldCheck, Zap, ArrowRight, Loader2, CheckCircle2, AlertCircle, Check, Phone, MessageCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const inputCls = `
  w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5
  text-xs font-medium text-slate-900 placeholder:text-slate-400
  focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20
  dark:border-slate-800 dark:bg-slate-900 dark:text-white
  dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20
  transition-all shadow-xs
`;

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function OrderContent() {
  const searchParams = useSearchParams();
  const initialPkgId = searchParams.get('package') || '1';
  const initialCycle = searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly';

  const [formStatus,     setFormStatus]     = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [serverPackages, setServerPackages] = useState<any[]>([]);
  const [annualDiscount, setAnnualDiscount] = useState<number>(20);
  const [selectedPkgId,  setSelectedPkgId]  = useState<string>(initialPkgId);
  const [billingCycle,   setBillingCycle]   = useState<'monthly' | 'yearly'>(initialCycle);

  useEffect(() => {
    fetch(`${API_BASE}/saas/packages`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          const filtered = data.data.filter((p: any) => 
            Number(p.is_public) === 1 && 
            p.package_key !== 'free_trial' && 
            p.package_key !== 'custom'
          );
          setServerPackages(filtered);
          if (data.annual_discount_percentage) {
            setAnnualDiscount(parseFloat(data.annual_discount_percentage));
          }
          if (initialPkgId && filtered.some((p: any) => String(p.id) === String(initialPkgId))) {
            setSelectedPkgId(initialPkgId);
          } else if (filtered.length > 0) {
            setSelectedPkgId(String(filtered[0].id));
          }
        }
      })
      .catch(err => console.error('Failed to load packages', err));
  }, [initialPkgId]);

  const currentPkg = serverPackages.find(p => String(p.id) === String(selectedPkgId)) || serverPackages[0];
  const monthlyPrice = currentPkg ? parseFloat(currentPkg.monthly_price || '0') : 0;
  const yearlyPrice  = currentPkg 
    ? (currentPkg.yearly_price ? parseFloat(currentPkg.yearly_price) : monthlyPrice * 12 * ((100 - annualDiscount) / 100)) 
    : 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatus(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    // Inject package_id and billing_cycle
    data.package_id = selectedPkgId;
    data.billing_cycle = billingCycle;

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (response.ok) {
        setFormStatus({ type: 'success', message: result.message });
        (e.target as HTMLFormElement).reset();
      } else {
        setFormStatus({ type: 'error', message: result.message });
      }
    } catch {
      setFormStatus({ type: 'error', message: 'Connection error. Please ensure the server is running.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pt-28 pb-24 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">

        {/* Page Header */}
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> 14-Day Free Enterprise Trial Included
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Create Your BizzFlow Instance
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Fill in your organization details to provision your dedicated enterprise workspace.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-10 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Plan & Cycle Summary Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Selected Plan</span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {currentPkg ? currentPkg.name : 'Loading Plan…'}
                  </h3>
                </div>

                {/* Billing Cycle Switch */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      billingCycle === 'yearly'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <span>Annual</span>
                    <span className="text-[9px] font-extrabold px-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                      Save {annualDiscount}%
                    </span>
                  </button>
                </div>
              </div>

              {/* Price Calculation Output */}
              <div className="flex items-baseline justify-between pt-3 border-t border-indigo-100 dark:border-indigo-900/40 text-xs">
                <span className="text-slate-500">Subscription Cost:</span>
                <div className="text-right">
                  {billingCycle === 'yearly' ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-slate-900 dark:text-white">${yearlyPrice.toFixed(0)} / year</span>
                      <span className="text-[11px] text-slate-400">(${(yearlyPrice / 12).toFixed(0)}/mo)</span>
                    </div>
                  ) : (
                    <span className="text-xl font-black text-slate-900 dark:text-white">${monthlyPrice.toFixed(0)} / month</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Company Name" required>
                <input name="company_name" required type="text" placeholder="e.g. Acme Corp" className={inputCls} />
              </FormField>
              <FormField label="Contact Person" required>
                <input name="contact_person" required type="text" placeholder="e.g. Alex Rivera" className={inputCls} />
              </FormField>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Work Email" required>
                <input name="email" required type="email" placeholder="alex@acme.com" className={inputCls} />
              </FormField>
              <FormField label="Contact Phone Number">
                <input name="contact_number" type="tel" placeholder="+94 77 123 4567" className={inputCls} />
              </FormField>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Business Category">
                <select name="business_type" className={`${inputCls} appearance-none cursor-pointer font-medium`}>
                  <option value="Automotive & Garage">Automotive & Garage Workshop</option>
                  <option value="Retail & POS">Retail & Supermarkets</option>
                  <option value="Hospitality & Hotel">Hotel & Banquet Venue</option>
                  <option value="Manufacturing">Manufacturing & Assembly</option>
                  <option value="General Enterprise">General Enterprise</option>
                </select>
              </FormField>
              <FormField label="Plan Tier">
                <select 
                  value={selectedPkgId}
                  onChange={(e) => setSelectedPkgId(e.target.value)}
                  className={`${inputCls} appearance-none cursor-pointer font-bold`}
                >
                  {serverPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name} Tier</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Business Address">
              <textarea name="address" rows={2} placeholder="123 Innovation Way, Colombo" className={`${inputCls} resize-none`} />
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Create Admin Password" required>
                <input name="password" required type="password" placeholder="••••••••" className={inputCls} />
              </FormField>
              <FormField label="Confirm Password" required>
                <input name="confirm_password" required type="password" placeholder="••••••••" className={inputCls} />
              </FormField>
            </div>

            {/* Status Feedback */}
            {formStatus && (
              <div className={`flex items-start gap-3 rounded-xl border p-4 text-xs ${
                formStatus.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400'
              }`}>
                {formStatus.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                <div>
                  <p className="font-bold">{formStatus.type === 'success' ? 'Registration Successful!' : 'Registration Failed'}</p>
                  <p className="mt-0.5 opacity-90">{formStatus.message}</p>
                </div>
              </div>
            )}

            <button
              disabled={isSubmitting}
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/25 disabled:opacity-60 group"
            >
              {isSubmitting ? (
                <><Loader2 size={15} className="animate-spin" /> Provisioning Instance…</>
              ) : (
                <><span>Initialize My Workspace</span><ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></>
              )}
            </button>

          </form>

          {/* Direct WhatsApp & Hotline Support Box */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-750">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Need Help with Plan Selection or Custom Deployment?
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Speak directly with our enterprise consultants.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="https://wa.me/94770481363?text=Hi%20BizzFlow%20Team%2C%20I%20would%20like%20assistance%20with%20deploying%20my%20ERP%20workspace."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-all shadow-xs"
              >
                <MessageCircle size={14} />
                <span>WhatsApp</span>
              </a>
              <a
                href="tel:+94770481363"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Phone size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span className="font-mono">0770 481 363</span>
              </a>
            </div>
          </div>

        </div>
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

