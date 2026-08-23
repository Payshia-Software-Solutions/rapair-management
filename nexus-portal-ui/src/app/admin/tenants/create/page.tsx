"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Plus, Globe, Mail, User, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

const inputCls = `
  w-full rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] py-2.5 px-3.5
  text-[13px] text-[#09090b] placeholder:text-[#a1a1aa]
  focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20
  dark:border-[#27272a] dark:bg-[#27272a] dark:text-white
  dark:focus:border-[#818cf8] dark:focus:ring-[#818cf8]/20
  transition-all
`;

export default function TenantCreatePage() {
  const router = useRouter();
  const [saving,   setSaving]   = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    package_id: '1',
    admin_email: '',
    business_type: '',
    address: '',
    currency: 'USD',
    billing_cycle: 'monthly',
    billing_cc_email: ''
  });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`${API_BASE}/admin/packages`, { credentials: 'include', headers })
      .then(res => res.json())
      .then(data => setPackages(data.data || []));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`${API_BASE}/admin/tenants/register`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData)
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

  return (
    <div className="w-full p-6 sm:p-8 space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <button 
            onClick={() => router.push('/admin/tenants')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors mb-2"
          >
            <ChevronLeft size={16} /> Back to Tenants Directory
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Register New Enterprise Instance
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Initialize and provision a new dedicated SaaS tenant environment.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Enterprise Name</label>
              <input 
                required
                placeholder="e.g. Acme Corporation"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">System Slug</label>
              <div className="relative">
                <input 
                  required
                  placeholder="acme-corp"
                  value={formData.slug}
                  onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                  className={`${inputCls} pr-20 font-mono`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">.bizzflow</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Administrative Email</label>
              <input 
                required
                type="email"
                placeholder="admin@enterprise.com"
                value={formData.admin_email}
                onChange={(e) => setFormData({...formData, admin_email: e.target.value})}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Subscription Tier</label>
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
                value={formData.billing_cycle}
                onChange={(e) => setFormData({...formData, billing_cycle: e.target.value})}
                className={`${inputCls} appearance-none cursor-pointer font-bold`}
              >
                <option value="monthly">Monthly Billing</option>
                <option value="yearly">Annual Billing (Save 20%)</option>
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
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Billing CC Email (Optional)</label>
              <input 
                type="email"
                placeholder="accounts@enterprise.com"
                value={formData.billing_cc_email}
                onChange={(e) => setFormData({...formData, billing_cc_email: e.target.value})}
                className={inputCls}
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => router.push('/admin/tenants')}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-xs font-bold text-white transition-all shadow-sm shadow-indigo-600/25 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              <span>Provision Instance</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
