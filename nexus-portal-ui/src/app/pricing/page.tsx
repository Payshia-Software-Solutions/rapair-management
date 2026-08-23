"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Zap, Check, HelpCircle, ArrowRight, ShieldCheck, Star, Phone, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [serverPackages, setServerPackages] = useState<any[]>([]);
  const [annualDiscount, setAnnualDiscount] = useState<number>(20);
  const [loading, setLoading] = useState(true);

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
        }
      })
      .catch(err => console.error('Failed to load packages', err))
      .finally(() => setLoading(false));
  }, []);

  const faqs = [
    { q: "Can I add or remove ERP modules later?", a: "Yes, absolutely! You can upgrade your package tier or request custom module add-ons at any time directly through your Nexus Client Portal." },
    { q: "Is there any setup or hidden installation fee?", a: "No setup fees. Your dedicated instance is provisioned automatically with cloud database backups included in the monthly price." },
    { q: "What payment methods are supported?", a: "We support Visa, MasterCard, Bank Wire Transfers, and local billing gateways. Invoices with downloadable PDF receipts are generated on each renewal." },
    { q: "How does the 14-day free trial work?", a: "You get unrestricted access to all selected ERP modules for 14 days without entering credit card details. You can upgrade anytime during or after the trial." }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pt-28 pb-24 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">

        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3.5 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Zap size={13} /> Simple, Transparent Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Scale your business with BizzFlow.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Choose the tier that fits your growth. Upgrade, downgrade, or customize your setup anytime.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="pt-2 flex items-center justify-center gap-3">
            <span className={`text-xs font-bold ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              Monthly Billing
            </span>
            <button
              type="button"
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                isAnnual ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isAnnual ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-bold flex items-center gap-1.5 ${isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              Annual Billing <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">Save {annualDiscount}%</span>
            </span>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" /> Loading live packages…
            </div>
          </div>
        ) : serverPackages.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-12">
            No public pricing plans available at the moment.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto items-stretch justify-center">
            {serverPackages.map((plan) => {
              const isPro = plan.package_key === 'pro' || plan.name.toLowerCase().includes('pro');
              const basePrice = parseFloat(plan.monthly_price || '0');
              const finalPrice = isAnnual 
                ? (plan.yearly_price ? (parseFloat(plan.yearly_price) / 12).toFixed(0) : (basePrice * ((100 - annualDiscount) / 100)).toFixed(0))
                : basePrice.toFixed(0);

              return (
                <div
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden transition-all p-7 ${
                    isPro
                      ? 'border-indigo-600 dark:border-indigo-500 shadow-xl shadow-indigo-600/10'
                      : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div>
                    {isPro && (
                      <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2.5 py-0.5 rounded-md mb-3">
                        Most Popular
                      </span>
                    )}

                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {plan.server_info || 'Enterprise Managed Container'}
                    </p>

                    <div className="my-5 space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-slate-900 dark:text-white">
                          ${finalPrice}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">/ month</span>
                      </div>
                      {isAnnual && basePrice > 0 && (
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          Billed annually (${plan.yearly_price ? parseFloat(plan.yearly_price).toFixed(0) : (basePrice * 12 * 0.8).toFixed(0)} / yr)
                        </p>
                      )}
                    </div>

                    <div className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Included Services</span>
                      {plan.features && Array.isArray(plan.features) ? (
                        plan.features.map((f: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                            <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f.feature_name || f}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>Full 15-Module Enterprise Access</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 mt-6">
                    <Link
                      href={`/order?package=${plan.id}&cycle=${isAnnual ? 'yearly' : 'monthly'}`}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                        isPro
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white'
                      }`}
                    >
                      <span>Deploy {plan.name}</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto pt-10 border-t border-slate-200/80 dark:border-slate-800 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Everything you need to know about our cloud licensing and billing.
            </p>
          </div>

          <div className="grid gap-4">
            {faqs.map((faq, i) => (
              <div key={i} className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle size={14} className="text-indigo-600 shrink-0" />
                  {faq.q}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 pl-5.5 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          {/* Direct Sales & Consultation Box */}
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-emerald-950/20 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Looking for Custom Multi-Location or On-Premise ERP?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Contact our enterprise deployment engineers directly for tailored pricing and live demonstration.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="https://wa.me/94770481363?text=Hi%20BizzFlow%20Team%2C%20I%20would%20like%20to%20inquire%20about%20custom%20ERP%20licensing."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-md shadow-emerald-600/20"
              >
                <MessageCircle size={15} />
                <span>Chat on WhatsApp</span>
              </a>
              <a
                href="tel:+94770481363"
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Phone size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span className="font-mono">0770 481 363</span>
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
