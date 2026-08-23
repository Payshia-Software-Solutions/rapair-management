"use client";
import { API_BASE } from '@/config';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Plus, X, Loader2, CheckCircle2, Eye, EyeOff, Activity,
  ShoppingCart, Users, Globe, Sparkles, Store, Smartphone, Wallet, Factory, Building2, Music, BarChart, LayoutDashboard, Truck, Zap, Shield, Check, Layers, Save
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const inputCls = `
  w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] py-2.5 px-3.5
  text-[13px] text-[#09090b] placeholder:text-[#a1a1aa]
  focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20
  dark:border-[#27272a] dark:bg-[#27272a] dark:text-white
  dark:focus:border-[#818cf8] dark:focus:ring-[#818cf8]/20
  transition-all
`;

interface ModuleItem {
  id: string;
  label: string;
  category: string;
  desc: string;
  icon: any;
}

const MODULE_CATEGORIES = [
  {
    name: 'Workshop & Operations',
    color: 'border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400',
    modules: [
      { id: 'coreFeatures', label: 'Core Features', category: 'Workshop & Operations', desc: 'Dashboards, Executive BI, and Analytics', icon: LayoutDashboard },
      { id: 'fleet', label: 'Fleet Management', category: 'Workshop & Operations', desc: 'Repair Orders, Bays, Vehicles & Technicians', icon: Truck },
      { id: 'inventory', label: 'Inventory & Warehouse', category: 'Workshop & Operations', desc: 'Stock Ledger, Barcodes, GRN & Transfers', icon: Zap },
      { id: 'vendors', label: 'Vendor Management', category: 'Workshop & Operations', desc: 'Suppliers, Purchase Invoices & Returns', icon: ShoppingCart },
      { id: 'production', label: 'Production & Manufacturing', category: 'Workshop & Operations', desc: 'BOM, Production Orders & Assembly', icon: Factory },
    ]
  },
  {
    name: 'Sales & Customer Growth',
    color: 'border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400',
    modules: [
      { id: 'sales', label: 'Sales & Invoicing', category: 'Sales & Customer Growth', desc: 'Invoices, Quotes, Receipts & Cheque Hub', icon: Globe },
      { id: 'crm', label: 'CRM & Lead Hub', category: 'Sales & Customer Growth', desc: 'Customer Directory, Vehicles & Inquiries', icon: Users },
      { id: 'marketing', label: 'Marketing & Promotions', category: 'Sales & Customer Growth', desc: 'Discounts, SMS/Email Campaigns & Segments', icon: Sparkles },
      { id: 'ecommerce', label: 'E-commerce Storefront', category: 'Sales & Customer Growth', desc: 'Online Orders, Store Catalog & Webhooks', icon: Store },
      { id: 'kiosk', label: 'Self-Service Kiosk', category: 'Sales & Customer Growth', desc: 'Self Check-in, Kiosk Orders & Displays', icon: Smartphone },
    ]
  },
  {
    name: 'Hospitality & Events',
    color: 'border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400',
    modules: [
      { id: 'frontOffice', label: 'Front Office & Rooms', category: 'Hospitality & Events', desc: 'Room Rack, Stay Reservations & Rates', icon: Building2 },
      { id: 'banquet', label: 'Banquet & Events', category: 'Hospitality & Events', desc: 'Halls, Menus, Event Calendars & Resources', icon: Music },
    ]
  },
  {
    name: 'Finance & Governance',
    color: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    modules: [
      { id: 'accounting', label: 'Accounting & Costing', category: 'Finance & Governance', desc: 'Chart of Accounts, Journal, Balance Sheet & Costing', icon: Wallet },
      { id: 'hrm', label: 'Human Resources (HRM)', category: 'Finance & Governance', desc: 'Employees, Attendance, Leave & Automated Payroll', icon: Users },
      { id: 'masterData', label: 'Master Data & Settings', category: 'Finance & Governance', desc: 'Tax Rates, Units, Spec Attributes & Tables', icon: BarChart },
    ]
  }
];

const ALL_MODULE_IDS = MODULE_CATEGORIES.flatMap(c => c.modules.map(m => m.id));

export default function PackageCreatePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  
  const [packageData, setPackageData] = useState({
    name: '',
    package_key: '',
    monthly_price: '',
    yearly_price: '',
    modules: [] as string[],
    services: [] as string[],
    server_info: 'Cloud Standard',
    is_public: 1
  });
  const [newService, setNewService] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
        const authRes = await fetch(`${API_BASE}/auth/check`, { credentials: 'include', headers });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.role !== 'super_admin') {
            router.push('/admin/dashboard');
            return;
          }
        } else {
          router.push('/admin/login');
          return;
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const toggleModule = (modId: string) => {
    if (packageData.modules.includes(modId)) {
      setPackageData({ ...packageData, modules: packageData.modules.filter(m => m !== modId) });
    } else {
      setPackageData({ ...packageData, modules: [...packageData.modules, modId] });
    }
  };

  const selectAllModules = () => {
    setPackageData({ ...packageData, modules: [...ALL_MODULE_IDS] });
  };

  const clearAllModules = () => {
    setPackageData({ ...packageData, modules: [] });
  };

  const toggleCategoryModules = (categoryModules: ModuleItem[]) => {
    const catIds = categoryModules.map(m => m.id);
    const allSelected = catIds.every(id => packageData.modules.includes(id));
    if (allSelected) {
      setPackageData({ ...packageData, modules: packageData.modules.filter(id => !catIds.includes(id)) });
    } else {
      const merged = Array.from(new Set([...packageData.modules, ...catIds]));
      setPackageData({ ...packageData, modules: merged });
    }
  };

  const addService = () => {
    if (newService.trim() && !packageData.services.includes(newService.trim())) {
      setPackageData({ ...packageData, services: [...packageData.services, newService.trim()] });
      setNewService('');
    }
  };

  const removeService = (service: string) => {
    setPackageData({ ...packageData, services: packageData.services.filter(s => s !== service) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageData.package_key) {
      setError('System identifier (Package Key) is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(`${API_BASE}/admin/packages/create`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(packageData)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Package tier created successfully');
        setTimeout(() => router.push('/admin/packages'), 1000);
      } else {
        setError(data.message || 'Failed to create package');
      }
    } catch {
      setError('Connection error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-[13px] text-[#a1a1aa]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e4e4e7] border-t-[#6366f1]" /> Checking authorization…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 sm:p-8 space-y-6 pb-16">
      {/* ── Top Navigation Bar ─────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/admin/packages')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e4e4e7] bg-white text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#09090b] dark:border-[#27272a] dark:bg-[#18181b] dark:text-[#a1a1aa] dark:hover:bg-[#27272a] dark:hover:text-white transition-all shadow-sm"
            title="Back to Packages"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-[#09090b] dark:text-white">
                {packageData.name || 'Create New Package Tier'}
              </h1>
              {packageData.package_key && (
                <span className="rounded-lg bg-[#6366f1]/10 px-2.5 py-0.5 text-xs font-mono font-bold text-[#6366f1] dark:bg-[#6366f1]/20 dark:text-[#818cf8]">
                  {packageData.package_key}
                </span>
              )}
            </div>
            <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-0.5">
              Configure module entitlements and subscription pricing for enterprise tenants.
            </p>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            onClick={() => router.push('/admin/packages')}
            className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-2 text-xs font-semibold text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#09090b] dark:border-[#27272a] dark:bg-[#18181b] dark:text-[#a1a1aa] dark:hover:bg-[#27272a] dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-5 py-2 text-xs font-bold text-white hover:bg-[#4f46e5] disabled:opacity-50 transition-all shadow-md shadow-[#6366f1]/20"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Creating Tier…' : 'Publish Package Tier'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-400 shadow-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-700 dark:border-green-800/40 dark:bg-green-950/40 dark:text-green-400 shadow-sm">
          {success}
        </div>
      )}

      {/* ── Main Two-Column Full-Width Grid ─────────────────── */}
      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* Left Column: Form & Module Selector (Span 8) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Card 1: Core Parameters */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 sm:p-7 dark:border-[#27272a] dark:bg-[#18181b] shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#f4f4f5] dark:border-[#27272a] pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#09090b] dark:text-white">
                  1. Tier Specifications & Identity
                </h3>
                <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-0.5">
                  General identification, pricing rates, and visibility policies.
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                packageData.is_public == 1 
                  ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:border-green-800/40 dark:text-green-400' 
                  : 'bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
              }`}>
                {packageData.is_public == 1 ? <Eye size={12} /> : <EyeOff size={12} />}
                {packageData.is_public == 1 ? 'Publicly Listed' : 'Private Tier'}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#71717a] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Public Tier Name
                </label>
                <input 
                  placeholder="e.g. Professional Plus"
                  value={packageData.name}
                  onChange={(e) => setPackageData({...packageData, name: e.target.value})}
                  className={inputCls}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#71717a] dark:text-[#a1a1aa] uppercase tracking-wider">
                  System Identifier (Key)
                </label>
                <input 
                  placeholder="e.g. professional-plus"
                  value={packageData.package_key}
                  onChange={(e) => setPackageData({...packageData, package_key: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                  className={`${inputCls} font-mono`}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#71717a] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Monthly Price (USD $)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a1a1aa]">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packageData.monthly_price}
                    onChange={(e) => {
                      const m = e.target.value;
                      setPackageData({
                        ...packageData, 
                        monthly_price: m,
                        yearly_price: m ? (parseFloat(m) * 12 * 0.80).toFixed(2) : ''
                      });
                    }}
                    className={`${inputCls} pl-8 font-mono font-bold`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-[#71717a] dark:text-[#a1a1aa] uppercase tracking-wider">
                    Annual / Yearly Price (USD $)
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Save 20% Applied</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a1a1aa]">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packageData.yearly_price}
                    onChange={(e) => setPackageData({...packageData, yearly_price: e.target.value})}
                    className={`${inputCls} pl-8 font-mono font-bold`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#71717a] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Infrastructure / Deployment Tier
                </label>
                <input 
                  placeholder="e.g. Cloud Std, Dedicated VM, Hybrid"
                  value={packageData.server_info}
                  onChange={(e) => setPackageData({...packageData, server_info: e.target.value})}
                  className={inputCls}
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#71717a] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Catalog Visibility
                </label>
                <button 
                  type="button"
                  onClick={() => setPackageData({...packageData, is_public: packageData.is_public == 1 ? 0 : 1})}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all ${
                    packageData.is_public == 1 
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/40 dark:bg-green-950/30 dark:text-green-400' 
                      : 'border-[#e4e4e7] bg-[#f4f4f5] text-[#71717a] dark:border-[#27272a] dark:bg-[#27272a] dark:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {packageData.is_public == 1 ? <Eye size={15} /> : <EyeOff size={15} />}
                    {packageData.is_public == 1 ? 'Listed in Client Portal' : 'Hidden from Client Portal'}
                  </span>
                  <span className="text-[11px] font-bold underline">Change</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Module Capabilities Matrix */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 sm:p-7 dark:border-[#27272a] dark:bg-[#18181b] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f4f4f5] dark:border-[#27272a] pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#09090b] dark:text-white">
                  2. System Capabilities & Module Entitlements
                </h3>
                <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-0.5">
                  Select which modules of the 15 ERP functional units are unlocked for this package.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllModules}
                  className="rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3.5 py-1.5 text-xs font-bold text-[#09090b] hover:bg-[#e4e4e7] dark:border-[#27272a] dark:bg-[#27272a] dark:text-white dark:hover:bg-[#3f3f46] transition-colors"
                >
                  Select All (15)
                </button>
                <button
                  type="button"
                  onClick={clearAllModules}
                  className="rounded-xl border border-[#e4e4e7] bg-white px-3.5 py-1.5 text-xs font-bold text-[#71717a] hover:bg-[#f4f4f5] dark:border-[#27272a] dark:bg-[#18181b] dark:text-[#a1a1aa] dark:hover:bg-[#27272a] transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {MODULE_CATEGORIES.map((category) => {
                const allCatSelected = category.modules.every(m => packageData.modules.includes(m.id));
                const activeCatCount = category.modules.filter(m => packageData.modules.includes(m.id)).length;
                
                return (
                  <div key={category.name} className="rounded-2xl border border-[#e4e4e7] dark:border-[#27272a] p-5 bg-[#fafafa]/60 dark:bg-[#1c1c1f]/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`rounded-lg border px-3 py-1 text-xs font-bold ${category.color}`}>
                          {category.name}
                        </span>
                        <span className="text-xs font-semibold text-[#71717a] dark:text-[#a1a1aa]">
                          {activeCatCount} of {category.modules.length} Enabled
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCategoryModules(category.modules)}
                        className="text-xs font-bold text-[#6366f1] hover:underline dark:text-[#818cf8]"
                      >
                        {allCatSelected ? 'Deselect Category' : 'Select All in Category'}
                      </button>
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                      {category.modules.map((mod) => {
                        const Icon = mod.icon;
                        const isActive = packageData.modules.includes(mod.id);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => toggleModule(mod.id)}
                            className={`group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                              isActive 
                                ? 'border-[#6366f1] bg-white shadow-md ring-2 ring-[#6366f1]/20 dark:border-[#818cf8] dark:bg-[#27272a] dark:ring-[#818cf8]/20' 
                                : 'border-[#e4e4e7] bg-white hover:border-[#cbd5e1] dark:border-[#27272a] dark:bg-[#18181b] dark:hover:border-[#3f3f46]'
                            }`}
                          >
                            <div className={`mt-0.5 rounded-xl p-2.5 transition-colors ${
                              isActive 
                                ? 'bg-[#6366f1]/10 text-[#6366f1] dark:bg-[#818cf8]/20 dark:text-[#818cf8]' 
                                : 'bg-[#f4f4f5] text-[#71717a] dark:bg-[#27272a] dark:text-[#a1a1aa]'
                            }`}>
                              <Icon size={20} />
                            </div>
                            <div className="flex-1 min-w-0 pr-5">
                              <p className={`text-[13px] font-bold truncate ${isActive ? 'text-[#09090b] dark:text-white' : 'text-[#52525b] dark:text-[#d4d4d8]'}`}>
                                {mod.label}
                              </p>
                              <p className="text-[11px] text-[#71717a] dark:text-[#a1a1aa] line-clamp-2 mt-1 leading-relaxed">
                                {mod.desc}
                              </p>
                              <span className="mt-2 inline-block font-mono text-[10px] text-[#a1a1aa] bg-[#f4f4f5] dark:bg-[#18181b] px-1.5 py-0.5 rounded border border-[#e4e4e7] dark:border-[#27272a]">
                                {mod.id}
                              </span>
                            </div>
                            <div className={`absolute top-4 right-4 h-5 w-5 rounded-lg border flex items-center justify-center transition-all ${
                              isActive
                                ? 'border-[#6366f1] bg-[#6366f1] text-white dark:border-[#818cf8] dark:bg-[#818cf8] shadow-sm'
                                : 'border-[#d4d4d8] bg-transparent dark:border-[#3f3f46]'
                            }`}>
                              {isActive && <Check size={12} strokeWidth={3} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Live Summary & SLAs (Span 4) */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-4">
          
          {/* Summary Card */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 dark:border-[#27272a] dark:bg-[#18181b] shadow-sm space-y-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa] dark:text-[#52525b]">
                Live Configuration Summary
              </span>
              <h3 className="text-lg font-black text-[#09090b] dark:text-white mt-1 truncate">
                {packageData.name || 'New Tier Draft'}
              </h3>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-[#6366f1] dark:text-[#818cf8]">
                  ${parseFloat(packageData.monthly_price || '0').toFixed(2)}
                </span>
                <span className="text-xs font-semibold text-[#71717a] dark:text-[#a1a1aa]">/ month</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 border-t border-[#f4f4f5] dark:border-[#27272a] pt-4">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#09090b] dark:text-white">Active Modules</span>
                <span className="text-[#6366f1] dark:text-[#818cf8]">
                  {packageData.modules.length} / {ALL_MODULE_IDS.length}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#f4f4f5] dark:bg-[#27272a]">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] transition-all duration-300"
                  style={{ width: `${(packageData.modules.length / ALL_MODULE_IDS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Quick Specs */}
            <div className="space-y-2.5 border-t border-[#f4f4f5] dark:border-[#27272a] pt-4 text-xs">
              <div className="flex justify-between">
                <span className="text-[#71717a] dark:text-[#a1a1aa]">Identifier</span>
                <span className="font-mono font-bold text-[#09090b] dark:text-white">{packageData.package_key || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717a] dark:text-[#a1a1aa]">Infrastructure</span>
                <span className="font-medium text-[#09090b] dark:text-white truncate max-w-[150px]">{packageData.server_info || 'Cloud Std'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717a] dark:text-[#a1a1aa]">Visibility</span>
                <span className={`font-bold ${packageData.is_public == 1 ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>
                  {packageData.is_public == 1 ? 'Public' : 'Private'}
                </span>
              </div>
            </div>

            {/* Save Button in Summary */}
            <div className="pt-2">
              <button 
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#6366f1] py-3 text-xs font-bold text-white hover:bg-[#4f46e5] disabled:opacity-50 transition-all shadow-md shadow-[#6366f1]/25"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Publishing Tier…' : 'Publish Package Tier'}
              </button>
            </div>
          </div>

          {/* Card 3: Managed Services & SLAs */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 dark:border-[#27272a] dark:bg-[#18181b] shadow-sm space-y-4">
            <div>
              <h4 className="text-sm font-bold text-[#09090b] dark:text-white">Managed Services & SLAs</h4>
              <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-0.5">
                Add SLA bullet points, backups, or support features.
              </p>
            </div>

            <div className="flex gap-2">
              <input 
                placeholder="e.g. 24/7 Priority SLA"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
                className={`${inputCls} text-xs py-2`}
              />
              <button 
                type="button"
                onClick={addService}
                className="flex items-center gap-1 shrink-0 rounded-xl bg-[#f4f4f5] px-3.5 text-xs font-bold text-[#09090b] hover:bg-[#e4e4e7] dark:bg-[#27272a] dark:text-white dark:hover:bg-[#3f3f46] transition-colors"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {packageData.services.map((srv) => (
                <span key={srv} className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-800 dark:border-green-800/40 dark:bg-green-950/30 dark:text-green-400">
                  <CheckCircle2 size={11} />
                  {srv}
                  <button type="button" onClick={() => removeService(srv)} className="ml-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {packageData.services.length === 0 && (
                <p className="text-xs text-[#a1a1aa] italic">No custom services attached.</p>
              )}
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
