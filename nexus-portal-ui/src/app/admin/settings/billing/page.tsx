"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import { Percent, Save, Loader2, CheckCircle2, AlertCircle, Sparkles, RefreshCw, Layers, ShieldCheck, ArrowRight } from 'lucide-react';

const PRESET_DISCOUNTS = [10, 15, 20, 25, 30];

export default function BillingSettingsPage() {
  const [discount, setDiscount] = useState<number>(20);
  const [recalculate, setRecalculate] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

        const res = await fetch(`${API_BASE}/admin/settings/billing`, { credentials: 'include', headers });
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setDiscount(parseFloat(json.data.annual_discount_percentage || '20'));
        }
      } catch (err) {
        console.error('Failed to load billing settings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const res = await fetch(`${API_BASE}/admin/settings/billing/update`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          annual_discount_percentage: discount,
          recalculate_packages: recalculate
        })
      });

      const json = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: json.message || 'Annual discount settings saved successfully!' });
      } else {
        setFeedback({ type: 'error', message: json.message || 'Failed to update billing settings' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Connection error while saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  const sampleProMonthly = 10;
  const sampleProYearly = sampleProMonthly * 12 * ((100 - discount) / 100);
  const sampleProSavings = (sampleProMonthly * 12) - sampleProYearly;

  const sampleEntMonthly = 25;
  const sampleEntYearly = sampleEntMonthly * 12 * ((100 - discount) / 100);
  const sampleEntSavings = (sampleEntMonthly * 12) - sampleEntYearly;

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" /> Loading billing rules…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 sm:p-8 space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Percent size={18} />
            </div>
            <span>Annual Discount & Billing Rules</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure standard percentage discounts applied when clients select Annual / Yearly subscriptions.
          </p>
        </div>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div className={`flex items-start gap-3 rounded-2xl border p-4 text-xs font-medium ${
          feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <div>
            <p className="font-bold">{feedback.type === 'success' ? 'Settings Saved' : 'Error'}</p>
            <p className="mt-0.5 opacity-90">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Form: Configuration (Span 7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-6">
            
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Annual Subscription Discount</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Set the discount rate applied on all yearly billing cycles across the public portal and invoices.
              </p>
            </div>

            {/* Slider & Number Input */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Discount Percentage
                </label>
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                    className="w-14 font-mono font-black text-right text-base text-indigo-600 dark:text-indigo-400 bg-transparent outline-none"
                  />
                  <span className="font-black text-slate-400 text-sm">%</span>
                </div>
              </div>

              {/* Range Slider */}
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none"
              />

              {/* Preset Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Quick Presets:</span>
                {PRESET_DISCOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDiscount(val)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      discount === val
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Recalculate Packages Option */}
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recalculate}
                  onChange={(e) => setRecalculate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-indigo-600"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Auto-recalculate all package yearly prices now
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Automatically updates the <code className="font-mono text-indigo-600">yearly_price</code> in <code className="font-mono">saas_packages</code> for Starter, Pro, Enterprise, etc., using the formula: <span className="font-semibold">monthly_price × 12 × (100 - {discount})%</span>.
                  </span>
                </div>
              </label>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/25 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>Save Billing Settings</span>
              </button>
            </div>

          </div>
        </div>

        {/* Right Column: Live Simulation & Breakdown (Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <Sparkles size={15} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Live Calculation Simulation</h3>
                <p className="text-[11px] text-slate-500">Preview how annual pricing will look with {discount}% discount.</p>
              </div>
            </div>

            <div className="space-y-4">
              
              {/* Pro Tier Example */}
              <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">Professional Tier</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                    Save ${sampleProSavings.toFixed(0)}/yr
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs pt-1">
                  <span className="text-slate-500">Monthly: ${sampleProMonthly}/mo ($120/yr)</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                    ${sampleProYearly.toFixed(2)} / yr
                  </span>
                </div>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold">
                  Equivalent to ${(sampleProYearly / 12).toFixed(2)}/month
                </p>
              </div>

              {/* Enterprise Tier Example */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Enterprise Tier</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                    Save ${sampleEntSavings.toFixed(0)}/yr
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs pt-1">
                  <span className="text-slate-500">Monthly: ${sampleEntMonthly}/mo ($300/yr)</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                    ${sampleEntYearly.toFixed(2)} / yr
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                  Equivalent to ${(sampleEntYearly / 12).toFixed(2)}/month
                </p>
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              <span>Applied instantly across pricing tables, order checkout, and invoices.</span>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
