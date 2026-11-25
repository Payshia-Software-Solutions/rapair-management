"use client";

import { adminFetch } from '@/lib/adminApi';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Save, X, Loader2, CheckCircle2, Eye, EyeOff, Activity,
  ShoppingCart, Users, Globe, Sparkles, Store, Smartphone, Wallet, Factory, Building2, Music, BarChart, LayoutDashboard, Truck, Zap, Shield, Check, Layers, Award, Plus
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

const inputCls = `
  w-full rounded-xl border border-nx-line bg-nx-surface-muted py-2.5 px-3.5
  text-[13px] text-nx-ink placeholder:text-nx-text-subtle
  focus:border-nx-accent focus:outline-none focus:ring-2 focus:ring-nx-accent/20
  dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white
  dark:focus:border-nx-accent-light dark:focus:ring-nx-accent-light/20
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
    color: 'border-nx-info/30 bg-nx-info text-nx-info dark:text-nx-info',
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
    color: 'border-nx-accent/30 bg-nx-accent-strong text-nx-accent dark:text-nx-accent-light',
    modules: [
      { id: 'sales', label: 'Sales & Invoicing', category: 'Sales & Customer Growth', desc: 'Invoices, Quotes, Receipts & Cheque Hub', icon: Globe },
      { id: 'crm', label: 'CRM & Lead Hub', category: 'Sales & Customer Growth', desc: 'Customer Directory, Vehicles & Inquiries', icon: Users },
      { id: 'marketing', label: 'Marketing & Promotions', category: 'Sales & Customer Growth', desc: 'Discounts, SMS/Email Campaigns & Segments', icon: Sparkles },
      { id: 'loyalty', label: 'Loyalty & Rewards', category: 'Sales & Customer Growth', desc: 'Points on every sale, member tiers & benefits', icon: Award },
      { id: 'ecommerce', label: 'E-commerce Storefront', category: 'Sales & Customer Growth', desc: 'Online Orders, Store Catalog & Webhooks', icon: Store },
      { id: 'kiosk', label: 'Self-Service Kiosk', category: 'Sales & Customer Growth', desc: 'Self Check-in, Kiosk Orders & Displays', icon: Smartphone },
    ]
  },
  {
    name: 'Hospitality & Events',
    color: 'border-nx-violet/30 bg-nx-violet text-nx-violet dark:text-nx-violet',
    modules: [
      { id: 'frontOffice', label: 'Front Office & Rooms', category: 'Hospitality & Events', desc: 'Room Rack, Stay Reservations & Rates', icon: Building2 },
      { id: 'banquet', label: 'Banquet & Events', category: 'Hospitality & Events', desc: 'Halls, Menus, Event Calendars & Resources', icon: Music },
    ]
  },
  {
    name: 'Finance & Governance',
    color: 'border-nx-success/30 bg-nx-success text-nx-success dark:text-nx-success',
    modules: [
      { id: 'accounting', label: 'Accounting & Costing', category: 'Finance & Governance', desc: 'Chart of Accounts, Journal, Balance Sheet & Costing', icon: Wallet },
      { id: 'hrm', label: 'Human Resources (HRM)', category: 'Finance & Governance', desc: 'Employees, Attendance, Leave & Automated Payroll', icon: Users },
      { id: 'masterData', label: 'Master Data & Settings', category: 'Finance & Governance', desc: 'Tax Rates, Units, Spec Attributes & Tables', icon: BarChart },
    ]
  }
];

const ALL_MODULE_IDS = MODULE_CATEGORIES.flatMap(c => c.modules.map(m => m.id));

export default function PackageEditPage() {
  const router = useRouter();
  const params = useParams();
  const id     = params.id;

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
    server_info: '',
    max_users: '5',
    max_locations: '1',
    custom_domain: 0,
    is_public: 1
  });
  const [newService, setNewService] = useState('');

  useEffect(() => {
    const fetchPackage = async () => {
      try {
        const headers: Record<string, string> = {};
        const authRes = await adminFetch(`/auth/check`, { headers });
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

        const res = await adminFetch(`/admin/packages/${id}`, { headers });
        if (!res.ok) throw new Error('Package not found');
        const data = await res.json();
        if (data.status === 'success') {
          const pkg = data.data;
          setPackageData({
            ...pkg,
            max_users: String(pkg.max_users ?? '5'),
            max_locations: String(pkg.max_locations ?? '1'),
            modules: typeof pkg.modules === 'string' ? JSON.parse(pkg.modules) : pkg.modules,
            services: typeof pkg.services === 'string' ? JSON.parse(pkg.services || '[]') : (pkg.services || [])
          });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPackage();
  }, [id, router]);

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
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const res = await adminFetch(`/admin/packages/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...packageData, id })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Package tier updated successfully');
        setTimeout(() => router.push('/admin/packages'), 1000);
      } else {
        setError(data.message || 'Failed to update package');
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
        <div className="flex items-center gap-2 text-[13px] text-nx-text-subtle">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-nx-line border-t-nx-accent" /> Loading package profile…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-8 space-y-6 pb-16">
      {/* ── Top Navigation Bar ─────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/admin/packages')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-nx-line bg-white text-nx-text-muted hover:bg-nx-surface-muted hover:text-nx-ink dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-nx-text-subtle dark:hover:bg-nx-line-dark dark:hover:text-white transition-all shadow-sm"
            title="Back to Packages"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-nx-ink dark:text-white">
                {packageData.name || 'Edit Package Tier'}
              </h1>
              <span className="rounded-lg bg-nx-accent/10 px-2.5 py-0.5 text-xs font-mono font-bold text-nx-accent dark:bg-nx-accent/20 dark:text-nx-accent-light">
                {packageData.package_key}
              </span>
            </div>
            <p className="text-xs text-nx-text-muted dark:text-nx-text-subtle mt-0.5">
              Configure tier parameters, system modules, SLAs and pricing.
            </p>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            onClick={() => router.push('/admin/packages')}
            className="rounded-xl border border-nx-line bg-white px-4 py-2 text-xs font-semibold text-nx-text-muted hover:bg-nx-surface-muted hover:text-nx-ink dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-nx-text-subtle dark:hover:bg-nx-line-dark dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-nx-accent px-5 py-2 text-xs font-bold text-white hover:bg-nx-accent-strong disabled:opacity-50 transition-all shadow-md shadow-nx-accent/20"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving Tier…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-nx-danger/30 bg-nx-danger-soft p-4 text-xs font-medium text-nx-danger shadow-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-nx-success/30 bg-nx-success-soft p-4 text-xs font-medium text-nx-success shadow-sm">
          {success}
        </div>
      )}

      {/* ── Main Two-Column Full-Width Grid ─────────────────── */}
      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* Left Column: Form & Module Selector (Span 8) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Card 1: Core Parameters */}
          <div className="rounded-2xl border border-nx-line bg-white p-6 sm:p-7 dark:border-nx-line-dark dark:bg-nx-surface-dark shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-nx-surface-muted dark:border-nx-line-dark pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-nx-ink dark:text-white">
                  1. Tier Specifications & Identity
                </h3>
                <p className="text-xs text-nx-text-muted dark:text-nx-text-subtle mt-0.5">
                  General identification, pricing rates, and visibility policies.
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                packageData.is_public == 1 
                  ? 'bg-nx-success-soft text-nx-success border border-nx-success/30 dark:bg-nx-success-soft dark:text-nx-success' 
                  : 'bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
              }`}>
                {packageData.is_public == 1 ? <Eye size={12} /> : <EyeOff size={12} />}
                {packageData.is_public == 1 ? 'Publicly Listed' : 'Private Tier'}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider">
                  Public Tier Name
                </label>
                <input 
                  placeholder="e.g. Enterprise Cloud Suite"
                  value={packageData.name}
                  onChange={(e) => setPackageData({...packageData, name: e.target.value})}
                  className={inputCls}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider">
                  Monthly Price (USD $)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-nx-text-subtle">$</span>
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
                        yearly_price: m && !packageData.yearly_price ? (parseFloat(m) * 12 * 0.80).toFixed(2) : packageData.yearly_price
                      });
                    }}
                    className={`${inputCls} pl-8 font-mono font-bold`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider">
                    Annual / Yearly Price (USD $)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const m = parseFloat(packageData.monthly_price || '0');
                      setPackageData({...packageData, yearly_price: (m * 12 * 0.80).toFixed(2)});
                    }}
                    className="text-[10px] font-bold text-nx-success hover:text-nx-success cursor-pointer"
                  >
                    Apply 20% Discount
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-nx-text-subtle">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packageData.yearly_price || ''}
                    onChange={(e) => setPackageData({...packageData, yearly_price: e.target.value})}
                    className={`${inputCls} pl-8 font-mono font-bold`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider">
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

              <div className="space-y-1.5">
                <label htmlFor="pkg-max-users" className="block text-[11px] font-semibold text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider">
                  User limit
                </label>
                <input
                  id="pkg-max-users"
                  type="number" min={1} inputMode="numeric"
                  value={packageData.max_users}
                  onChange={(e) => setPackageData({...packageData, max_users: e.target.value})}
                  className={inputCls}
                />
                <p className="text-[11px] text-nx-text-subtle">Active staff accounts. 999 or more = unlimited.</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pkg-max-locations" className="block text-[11px] font-semibold text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider">
                  Branch limit
                </label>
                <input
                  id="pkg-max-locations"
                  type="number" min={1} inputMode="numeric"
                  value={packageData.max_locations}
                  onChange={(e) => setPackageData({...packageData, max_locations: e.target.value})}
                  className={inputCls}
                />
                <p className="text-[11px] text-nx-text-subtle">Locations / branches. 999 or more = unlimited.</p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-nx-line bg-nx-surface-muted px-4 py-2.5 text-[13px] font-medium text-nx-ink dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white">
                  <input
                    type="checkbox"
                    checked={Number(packageData.custom_domain) === 1}
                    onChange={(e) => setPackageData({...packageData, custom_domain: e.target.checked ? 1 : 0})}
                    className="h-4 w-4 accent-nx-accent"
                  />
                  Allow a custom domain (the customer can connect their own domain)
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-nx-text-muted dark:text-nx-text-subtle uppercase tracking-wider">
                  Catalog Visibility
                </label>
                <button 
                  type="button"
                  onClick={() => setPackageData({...packageData, is_public: packageData.is_public == 1 ? 0 : 1})}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all ${
                    packageData.is_public == 1 
                      ? 'border-nx-success/30 bg-nx-success-soft text-nx-success dark:border-nx-success/30 dark:text-nx-success' 
                      : 'border-nx-line bg-nx-surface-muted text-nx-text-muted dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white'
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
          <div className="rounded-2xl border border-nx-line bg-white p-6 sm:p-7 dark:border-nx-line-dark dark:bg-nx-surface-dark shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-nx-surface-muted dark:border-nx-line-dark pb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-nx-ink dark:text-white">
                  2. System Capabilities & Module Entitlements
                </h3>
                <p className="text-xs text-nx-text-muted dark:text-nx-text-subtle mt-0.5">
                  Select which modules of the 15 ERP functional units are unlocked for this package.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllModules}
                  className="rounded-xl border border-nx-line bg-nx-surface-muted px-3.5 py-1.5 text-xs font-bold text-nx-ink hover:bg-nx-line dark:border-nx-line-dark dark:bg-nx-line-dark dark:text-white dark:hover:bg-nx-line-dark-strong transition-colors"
                >
                  Select All (15)
                </button>
                <button
                  type="button"
                  onClick={clearAllModules}
                  className="rounded-xl border border-nx-line bg-white px-3.5 py-1.5 text-xs font-bold text-nx-text-muted hover:bg-nx-surface-muted dark:border-nx-line-dark dark:bg-nx-surface-dark dark:text-nx-text-subtle dark:hover:bg-nx-line-dark transition-colors"
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
                  <div key={category.name} className="rounded-2xl border border-nx-line dark:border-nx-line-dark p-5 bg-nx-surface-soft/60 dark:bg-nx-surface-dark-2/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`rounded-lg border px-3 py-1 text-xs font-bold ${category.color}`}>
                          {category.name}
                        </span>
                        <span className="text-xs font-semibold text-nx-text-muted dark:text-nx-text-subtle">
                          {activeCatCount} of {category.modules.length} Enabled
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCategoryModules(category.modules)}
                        className="text-xs font-bold text-nx-accent hover:underline dark:text-nx-accent-light"
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
                                ? 'border-nx-accent bg-white shadow-md ring-2 ring-nx-accent/20 dark:border-nx-accent-light dark:bg-nx-line-dark dark:ring-nx-accent-light/20' 
                                : 'border-nx-line bg-white hover:border-[#cbd5e1] dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:border-nx-line-dark-strong'
                            }`}
                          >
                            <div className={`mt-0.5 rounded-xl p-2.5 transition-colors ${
                              isActive 
                                ? 'bg-nx-accent/10 text-nx-accent dark:bg-nx-accent-light/20 dark:text-nx-accent-light' 
                                : 'bg-nx-surface-muted text-nx-text-muted dark:bg-nx-line-dark dark:text-nx-text-subtle'
                            }`}>
                              <Icon size={20} />
                            </div>
                            <div className="flex-1 min-w-0 pr-5">
                              <p className={`text-[13px] font-bold truncate ${isActive ? 'text-nx-ink dark:text-white' : 'text-nx-text-strong dark:text-nx-line-strong'}`}>
                                {mod.label}
                              </p>
                              <p className="text-[11px] text-nx-text-muted dark:text-nx-text-subtle line-clamp-2 mt-1 leading-relaxed">
                                {mod.desc}
                              </p>
                              <span className="mt-2 inline-block font-mono text-[10px] text-nx-text-subtle bg-nx-surface-muted dark:bg-nx-surface-dark px-1.5 py-0.5 rounded border border-nx-line dark:border-nx-line-dark">
                                {mod.id}
                              </span>
                            </div>
                            <div className={`absolute top-4 right-4 h-5 w-5 rounded-lg border flex items-center justify-center transition-all ${
                              isActive
                                ? 'border-nx-accent bg-nx-accent text-white dark:border-nx-accent-light dark:bg-nx-accent-light shadow-sm'
                                : 'border-nx-line-strong bg-transparent dark:border-nx-line-dark-strong'
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
          <div className="rounded-2xl border border-nx-line bg-white p-6 dark:border-nx-line-dark dark:bg-nx-surface-dark shadow-sm space-y-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-nx-text-subtle dark:text-nx-text-strong">
                Live Configuration Summary
              </span>
              <h3 className="text-lg font-black text-nx-ink dark:text-white mt-1 truncate">
                {packageData.name || 'Untitled Tier'}
              </h3>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-nx-accent dark:text-nx-accent-light">
                  ${parseFloat(packageData.monthly_price || '0').toFixed(2)}
                </span>
                <span className="text-xs font-semibold text-nx-text-muted dark:text-nx-text-subtle">/ month</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 border-t border-nx-surface-muted dark:border-nx-line-dark pt-4">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-nx-ink dark:text-white">Active Modules</span>
                <span className="text-nx-accent dark:text-nx-accent-light">
                  {packageData.modules.length} / {ALL_MODULE_IDS.length}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-nx-surface-muted dark:bg-nx-line-dark">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-nx-accent to-nx-accent-light transition-all duration-300"
                  style={{ width: `${(packageData.modules.length / ALL_MODULE_IDS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Quick Specs */}
            <div className="space-y-2.5 border-t border-nx-surface-muted dark:border-nx-line-dark pt-4 text-xs">
              <div className="flex justify-between">
                <span className="text-nx-text-muted dark:text-nx-text-subtle">Identifier</span>
                <span className="font-mono font-bold text-nx-ink dark:text-white">{packageData.package_key}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nx-text-muted dark:text-nx-text-subtle">Infrastructure</span>
                <span className="font-medium text-nx-ink dark:text-white truncate max-w-[150px]">{packageData.server_info || 'Cloud Std'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nx-text-muted dark:text-nx-text-subtle">Visibility</span>
                <span className={`font-bold ${packageData.is_public == 1 ? 'text-nx-success dark:text-nx-success' : 'text-zinc-500'}`}>
                  {packageData.is_public == 1 ? 'Public' : 'Private'}
                </span>
              </div>
            </div>

            {/* Save Button in Summary */}
            <div className="pt-2">
              <button 
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-nx-accent py-3 text-xs font-bold text-white hover:bg-nx-accent-strong disabled:opacity-50 transition-all shadow-md shadow-nx-accent/25"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Updating Package…' : 'Save Package Tier'}
              </button>
            </div>
          </div>

          {/* Card 3: Managed Services & SLAs */}
          <div className="rounded-2xl border border-nx-line bg-white p-6 dark:border-nx-line-dark dark:bg-nx-surface-dark shadow-sm space-y-4">
            <div>
              <h4 className="text-sm font-bold text-nx-ink dark:text-white">Managed Services & SLAs</h4>
              <p className="text-xs text-nx-text-muted dark:text-nx-text-subtle mt-0.5">
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
                className="flex items-center gap-1 shrink-0 rounded-xl bg-nx-surface-muted px-3.5 text-xs font-bold text-nx-ink hover:bg-nx-line dark:bg-nx-line-dark dark:text-white dark:hover:bg-nx-line-dark-strong transition-colors"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {packageData.services.map((srv) => (
                <span key={srv} className="inline-flex items-center gap-1.5 rounded-lg border border-nx-success/30 bg-nx-success-soft px-2.5 py-1 text-[11px] font-bold text-nx-success">
                  <CheckCircle2 size={11} />
                  {srv}
                  <button type="button" onClick={() => removeService(srv)} className="ml-1 text-nx-success hover:text-nx-success">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {packageData.services.length === 0 && (
                <p className="text-xs text-nx-text-subtle italic">No custom services attached.</p>
              )}
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
