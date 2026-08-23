"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Save, RefreshCcw, ShieldCheck, Layers, Plus, Trash2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

const inputCls = `
  w-full rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] py-2.5 px-3.5
  text-[13px] text-[#09090b] placeholder:text-[#a1a1aa]
  focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20
  dark:border-[#27272a] dark:bg-[#27272a] dark:text-white
  dark:focus:border-[#818cf8] dark:focus:ring-[#818cf8]/20
  transition-all
`;

export default function TenantEditPage() {
  const router = useRouter();
  const params = useParams();
  const id     = params.id;

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    slug: string;
    package_id: string;
    status: string;
    license_key: string;
    api_key: string;
    trial_expiry: string;
    currency: string;
    billing_cycle: string;
    billing_cc_email: string[];
    admin_email: string;
    contact_number: string;
  }>({
    id: '',
    name: '',
    slug: '',
    package_id: '',
    status: '',
    license_key: '',
    api_key: '',
    trial_expiry: '',
    currency: 'USD',
    billing_cycle: 'monthly',
    billing_cc_email: [],
    admin_email: '',
    contact_number: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

        const [packagesRes, tenantRes] = await Promise.all([
          fetch(`${API_BASE}/admin/packages`, { credentials: 'include', headers }),
          fetch(`${API_BASE}/admin/tenants/${id}`, { credentials: 'include', headers })
        ]);
        
        const packagesData = await packagesRes.json();
        const tenantData   = await tenantRes.json();
        
        setPackages(packagesData.data || []);
        if (tenantData.status === 'success') {
          const tenant = tenantData.data;
          let ccEmails: string[] = [];
          try {
            const decoded = JSON.parse(tenant.billing_cc_email);
            if (Array.isArray(decoded)) ccEmails = decoded;
            else if (tenant.billing_cc_email) ccEmails = [tenant.billing_cc_email];
          } catch {
            if (tenant.billing_cc_email) ccEmails = tenant.billing_cc_email.split(',').map((e: string) => e.trim());
          }
          setFormData({
            ...tenant,
            billing_cc_email: ccEmails
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const payload = {
        ...formData,
        billing_cc_email: JSON.stringify(formData.billing_cc_email)
      };
      const res = await fetch(`${API_BASE}/admin/tenants/update`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        router.push('/admin/tenants');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const regenerateKey = (type: 'license' | 'api') => {
    if (type === 'license') {
      const random = Array.from(crypto.getRandomValues(new Uint8Array(10))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const newLicense = `RM-${formData.slug.toUpperCase()}-${random.substring(0, 5)}-${random.substring(5, 10)}-${random.substring(10, 15)}-${random.substring(15, 20)}`;
      setFormData({ ...formData, license_key: newLicense });
    } else {
      const apiRandom = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
      setFormData({ ...formData, api_key: `NX-${apiRandom}` });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-[13px] text-[#a1a1aa]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e4e4e7] border-t-[#6366f1]" /> Loading instance profile…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 sm:p-8 space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <button 
            onClick={() => router.push('/admin/tenants')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors mb-2"
          >
            <ChevronLeft size={16} /> Back to Tenants Directory
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Edit {formData.name || 'Tenant Instance'}
            </h1>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
              formData.status === 'Active'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/40'
                : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/40'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${formData.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {formData.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage enterprise parameters, subscription lifecycle, and security credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/admin/tenants')}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white transition-all shadow-sm shadow-indigo-600/25 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? 'Saving…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Responsive Form Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Form Sections (Span 8) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          
          {/* Card 1: Enterprise Profile & Contact */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Layers size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Enterprise Profile & General Info</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Basic enterprise identity and administrative contact channels.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Enterprise Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={inputCls} 
                  placeholder="e.g. Payshia Software Solutions"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">System Slug (Workspace Subdomain)</label>
                <div className="relative">
                  <input 
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    className={`${inputCls} font-mono`} 
                    placeholder="payshia-software"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Administrative Email</label>
                <input 
                  required
                  type="email"
                  value={formData.admin_email}
                  onChange={(e) => setFormData({...formData, admin_email: e.target.value})}
                  className={inputCls} 
                  placeholder="admin@enterprise.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Contact Number</label>
                <input 
                  value={formData.contact_number || ''}
                  onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                  className={inputCls} 
                  placeholder="+94 77 123 4567"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Subscription & Billing Parameters */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Subscription & Billing Parameters</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Plan tier, lifecycle state, renewal dates, and billing currency.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Plan Tier</label>
                <select 
                  value={formData.package_id}
                  onChange={(e) => setFormData({...formData, package_id: e.target.value})}
                  className={`${inputCls} appearance-none cursor-pointer font-bold`}
                >
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Billing Cycle</label>
                <select 
                  value={formData.billing_cycle || 'monthly'}
                  onChange={(e) => setFormData({...formData, billing_cycle: e.target.value})}
                  className={`${inputCls} appearance-none cursor-pointer font-bold`}
                >
                  <option value="monthly">Monthly Billing</option>
                  <option value="yearly">Annual Billing (Save 20%)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Instance Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className={`${inputCls} appearance-none cursor-pointer font-bold`}
                >
                  <option value="Active">Active (Operational)</option>
                  <option value="Trial">Trial (14-Day Free)</option>
                  <option value="Suspended">Suspended (Locked)</option>
                  <option value="Expired">Expired (Overdue)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Billing Currency</label>
                <select 
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  className={`${inputCls} appearance-none cursor-pointer font-bold`}
                >
                  <option value="USD">USD - US Dollar ($)</option>
                  <option value="LKR">LKR - Sri Lankan Rupee (Rs)</option>
                  <option value="EUR">EUR - Euro (€)</option>
                  <option value="GBP">GBP - British Pound (£)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Trial / Renewal Expiry Date</label>
                <input 
                  type="date"
                  value={formData.trial_expiry || ''}
                  onChange={(e) => setFormData({...formData, trial_expiry: e.target.value})}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Billing CC Recipients */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Billing CC Recipients</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Additional email inboxes that receive billing notifications and automated invoices.</p>
              </div>
              <button 
                type="button"
                onClick={() => setFormData({...formData, billing_cc_email: [...formData.billing_cc_email, '']})}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
              >
                <Plus size={13} /> Add Recipient
              </button>
            </div>

            <div className="space-y-2.5">
              {formData.billing_cc_email.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No CC recipients configured yet.</p>
              ) : (
                formData.billing_cc_email.map((email: string, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input 
                      type="email"
                      placeholder="accounts@enterprise.com"
                      value={email}
                      onChange={(e) => {
                        const newCcs = [...formData.billing_cc_email];
                        newCcs[idx] = e.target.value;
                        setFormData({...formData, billing_cc_email: newCcs});
                      }}
                      className={inputCls} 
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const newCcs = formData.billing_cc_email.filter((_, i) => i !== idx);
                        setFormData({...formData, billing_cc_email: newCcs});
                      }}
                      className="rounded-xl p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 4: Keys & Security */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Security & API Access</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage tenant license verification and API handshake keys.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Application License Key</label>
                <div className="flex gap-2">
                  <input readOnly value={formData.license_key} className={`${inputCls} font-mono bg-slate-50 dark:bg-slate-950 select-all font-semibold`} />
                  <button 
                    type="button" 
                    onClick={() => regenerateKey('license')} 
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                    title="Regenerate License Key"
                  >
                    <RefreshCcw size={15} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">API Access Key</label>
                <div className="flex gap-2">
                  <input readOnly value={formData.api_key} className={`${inputCls} font-mono bg-slate-50 dark:bg-slate-950 select-all font-semibold`} />
                  <button 
                    type="button" 
                    onClick={() => regenerateKey('api')} 
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                    title="Regenerate API Key"
                  >
                    <RefreshCcw size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Sticky Status & Quick Actions (Span 4) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-20">
          
          {/* Quick Publish Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Publish Action</h3>
            <div className="space-y-2.5">
              <button 
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/25 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>Save All Changes</span>
              </button>
              <button 
                type="button"
                onClick={() => router.push('/admin/tenants')}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Discard & Return
              </button>
            </div>
          </div>

          {/* Instance Telemetry / Overview */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Instance Overview</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Instance ID</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">#{formData.id}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Subdomain</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{formData.slug}.bizzflow.cloud</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Active Currency</span>
                <span className="font-bold text-slate-900 dark:text-white">{formData.currency}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Renewal Expiry</span>
                <span className="font-bold text-slate-900 dark:text-white">{formData.trial_expiry || 'N/A'}</span>
              </div>
            </div>
          </div>

        </div>

      </form>
    </div>
  );
}
