"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, ArrowRight, Layers, BarChart3, Users, Box, Globe, ChevronRight, 
  Sparkles, CheckCircle2, Truck, Zap, ShoppingCart, Factory, Building2, Music, 
  Wallet, Smartphone, Store, Check, ArrowUpRight, Play, Star, Server, Lock, Clock
} from 'lucide-react';
import { API_BASE } from '@/config';

// ── 15 ERP Modules Data Matrix ─────────────────────────────────────
const MODULES_CATALOG = [
  // Workshop & Operations
  { id: 'coreFeatures', name: 'Executive Dashboards', category: 'Operations', desc: 'Real-time KPI telemetry, financial charts & multi-branch BI analytics.', icon: BarChart3, color: 'from-blue-500 to-indigo-600', badge: 'Core' },
  { id: 'fleet', name: 'Fleet & Repair OS', category: 'Operations', desc: 'Digital repair job cards, vehicle diagnostics, technician bays & warranty tracking.', icon: Truck, color: 'from-blue-600 to-cyan-600', badge: 'Popular' },
  { id: 'inventory', name: 'Inventory & Stock Intel', category: 'Operations', desc: 'Multi-warehouse stock, barcode scanning, batch tracking & low-stock alerts.', icon: Zap, color: 'from-amber-500 to-orange-600', badge: 'Essential' },
  { id: 'vendors', name: 'Vendor Hub', category: 'Operations', desc: 'Supplier database, purchase orders, goods received notes & automated restock.', icon: ShoppingCart, color: 'from-emerald-500 to-teal-600' },
  { id: 'production', name: 'Manufacturing & BOM', category: 'Operations', desc: 'Multi-level Bill of Materials, production order routing & workstation tracking.', icon: Factory, color: 'from-stone-500 to-zinc-600' },

  // Sales & Growth
  { id: 'sales', name: 'Sales & Invoicing', category: 'Sales', desc: 'Customizable PDF invoices, automated payment reminders & recurring billing engine.', icon: Globe, color: 'from-indigo-500 to-purple-600', badge: 'High ROI' },
  { id: 'crm', name: 'CRM & Customer Hub', category: 'Sales', desc: 'Customer 360 view, lead pipelines, appointment scheduling & service history logs.', icon: Users, color: 'from-violet-500 to-fuchsia-600' },
  { id: 'marketing', name: 'Promotions & Campaigns', category: 'Sales', desc: 'Tiered discount codes, seasonal deals, gift vouchers & SMS trigger marketing.', icon: Sparkles, color: 'from-pink-500 to-rose-600' },
  { id: 'ecommerce', name: 'E-commerce Storefront', category: 'Sales', desc: 'Integrated online catalog, digital storefront & automatic web order sync.', icon: Store, color: 'from-sky-500 to-blue-600' },
  { id: 'kiosk', name: 'Self-Service Kiosks', category: 'Sales', desc: 'Interactive touchscreen guest check-in, self-checkout kiosks & digital queues.', icon: Smartphone, color: 'from-teal-500 to-emerald-600' },

  // Hospitality & Events
  { id: 'frontOffice', name: 'Front Office & Hotel', category: 'Hospitality', desc: 'Room reservation calendar, guest registration, keycards & folio check-out.', icon: Building2, color: 'from-amber-600 to-amber-700' },
  { id: 'banquet', name: 'Banquet & Events', category: 'Hospitality', desc: 'Hall venue bookings, catering menus, event scheduling & guest management.', icon: Music, color: 'from-rose-500 to-red-600' },

  // Finance & Governance
  { id: 'accounting', name: 'Accounting & Ledger', category: 'Finance', desc: 'Full double-entry general ledger, Chart of Accounts, P&L & Balance Sheet reports.', icon: Wallet, color: 'from-emerald-600 to-green-700', badge: 'Compliant' },
  { id: 'hrm', name: 'Human Resources (HRM)', category: 'Finance', desc: 'Employee master, biometric attendance, leave policies & automated payroll engine.', icon: Users, color: 'from-cyan-600 to-blue-700' },
  { id: 'masterData', name: 'Master Data & Governance', category: 'Finance', desc: 'Centralized tax tables, currency exchange, unit definitions & audit logs.', icon: Layers, color: 'from-slate-600 to-gray-700' },
];

export default function LandingPage() {
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Operations' | 'Sales' | 'Hospitality' | 'Finance'>('All');
  const [isAnnual, setIsAnnual] = useState(true);
  const [packages, setPackages] = useState<any[]>([]);
  const [annualDiscount, setAnnualDiscount] = useState<number>(20);
  const [activeAppIndex, setActiveAppIndex] = useState(0);

  // Fetch live public packages
  useEffect(() => {
    fetch(`${API_BASE}/saas/packages`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && Array.isArray(data.data)) {
          const publicOnly = data.data.filter((p: any) => Number(p.is_public) === 1);
          setPackages(publicOnly);
          if (data.annual_discount_percentage) {
            setAnnualDiscount(parseFloat(data.annual_discount_percentage));
          }
        }
      })
      .catch(() => {});
  }, []);

  const filteredModules = selectedCategory === 'All'
    ? MODULES_CATALOG
    : MODULES_CATALOG.filter(m => m.category === selectedCategory);

  const heroPreviewModules = [
    { title: 'Fleet OS & Repair Orders', stat: '142 Active Jobs', change: '+18% today', desc: 'Automated technician bay scheduling & digital diagnostic checklists.' },
    { title: 'Inventory & Warehousing', stat: '12,480 SKUs Synced', change: 'Zero Discrepancies', desc: 'Multi-location real-time stock sync with barcode GRN automation.' },
    { title: 'Point of Sale & Invoicing', stat: '$48,920 Revenue', change: 'Multi-currency ready', desc: 'Lightning-fast checkout with automated tax and split payment splits.' },
    { title: 'Accounting & Payroll', stat: 'Balanced P&L', change: '100% Tax Compliant', desc: 'Automated double-entry journals, bank reconciliation & staff payroll.' },
  ];

  return (
    <div className="flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen selection:bg-indigo-500 selection:text-white">

      {/* ── 1. HERO SECTION ─────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-32 overflow-hidden bg-gradient-to-b from-slate-50/80 via-white to-slate-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">

            {/* Announcement Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/90 dark:border-indigo-800/40 dark:bg-indigo-950/50 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-xs backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
              <span>Next-Gen Enterprise Architecture</span>
              <span className="text-indigo-400">·</span>
              <span className="text-slate-600 dark:text-slate-400">15+ Integrated ERP Apps</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.08]">
              All your business on <br />
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 bg-clip-text text-transparent">
                one unified platform.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
              Simple, lightning-fast, and deeply integrated. Say goodbye to painful software integrations and manage your entire business lifecycle in one workspace.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/order"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-7 py-3.5 text-sm font-bold text-white transition-all shadow-md shadow-indigo-600/25 hover:shadow-lg hover:shadow-indigo-600/30 hover:-translate-y-0.5 group"
              >
                <span>Start Free Trial</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="#modules"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-7 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
              >
                <Play size={14} className="fill-slate-700 dark:fill-slate-200" />
                <span>Explore Live Modules</span>
              </Link>
            </div>

            {/* Trust Points */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500 stroke-[3]" /> 14-Day Free Trial</span>
              <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500 stroke-[3]" /> Instant Cloud Deployment</span>
              <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500 stroke-[3]" /> No Credit Card Required</span>
            </div>

          </div>

          {/* ── Interactive Hero Showcase Mockup ───────────────────────── */}
          <div className="mt-14 max-w-5xl mx-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 sm:p-4 shadow-2xl shadow-slate-200/50 dark:shadow-none">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 space-y-6">
              
              {/* Mockup Window Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-[11px] text-slate-400 font-semibold">bizzflow.cloud · Live Enterprise Environment</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {heroPreviewModules.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveAppIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        activeAppIndex === idx
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800'
                      }`}
                    >
                      {item.title.split(' & ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Mockup Display */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="md:col-span-2 space-y-3 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Module Showcase
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/50">
                      Live Telemetry
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {heroPreviewModules[activeAppIndex].title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {heroPreviewModules[activeAppIndex].desc}
                  </p>
                  <div className="pt-2 flex items-baseline gap-3">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {heroPreviewModules[activeAppIndex].stat}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {heroPreviewModules[activeAppIndex].change}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 p-5 rounded-xl bg-gradient-to-br from-indigo-500/10 via-slate-100 to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Integrated Highlights</h4>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-indigo-600" /> Zero manual syncing</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-indigo-600" /> Multi-device responsive</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-indigo-600" /> Automated audit logs</li>
                  </ul>
                  <Link href="/order" className="mt-3 block text-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 transition-colors">
                    Test Drive Module →
                  </Link>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 2. 15-MODULE APPLICATION MATRIX ──────────────────────────── */}
      <section id="modules" className="py-24 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/70 dark:bg-slate-800 px-3 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <Layers size={13} className="text-indigo-600" /> Complete ERP Ecosystem
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              An application for every need.
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              From your workshop bay to your balance sheet, everything works together out of the box.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {(['All', 'Operations', 'Sales', 'Hospitality', 'Finance'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800'
                }`}
              >
                {cat === 'All' ? 'All 15 Apps' : cat}
              </button>
            ))}
          </div>

          {/* 15 Modules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.id}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${mod.color} text-white shadow-sm group-hover:scale-105 transition-transform`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      {mod.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                          {mod.badge}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {mod.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {mod.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                        {mod.desc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-4">
                    <span className="text-[11px] font-bold text-slate-400 font-mono">
                      #{mod.id}
                    </span>
                    <Link
                      href="/order"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform"
                    >
                      <span>Deploy App</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ── 3. "WHY BIZZFLOW OVER DISCONNECTED TOOLS" ────────────────── */}
      <section className="py-24 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Stop stitching together 6 different softwares.
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Traditional ERP setups are complex, expensive, and require dozens of fragile API bridges. BizzFlow is natively integrated from day one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            
            {/* The Old Way */}
            <div className="p-8 rounded-2xl bg-red-50/40 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 space-y-5">
              <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Traditional Setup
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Fragmented Point Solutions
              </h3>
              <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold">✕</span> Separate monthly bill for POS, Accounting, CRM, and Inventory.
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold">✕</span> Constant synchronization errors and mismatched stock numbers.
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold">✕</span> Staff must switch between 5 different browser tabs and logins.
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold">✕</span> Expensive consultants needed for simple customization.
                </li>
              </ul>
            </div>

            {/* The BizzFlow Way */}
            <div className="p-8 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-5 shadow-lg shadow-indigo-600/5">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                The BizzFlow Unified Way
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Single Core Database & Unified Engine
              </h3>
              <ul className="space-y-3 text-xs text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" /> One single predictable monthly subscription with unlimited scaling.
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" /> When a job card closes in Fleet OS, stock automatically deducts and journals post.
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" /> One login for all roles — Admins, Technicians, Cashiers, and Accountants.
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" /> Turn modules on or off with 1 click from your Nexus SaaS Portal.
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      {/* ── 4. LIVE PRICING SHOWCASE ──────────────────────────────────── */}
      <section className="py-24 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
              <Zap size={13} /> Transparent Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Predictable plans built for growth.
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Deploy your private instance today. Upgrade or customize your package tiers anytime.
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <span className={`text-xs font-bold ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                Monthly
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
                Annual <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">Save {annualDiscount}%</span>
              </span>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {packages.length === 0 ? (
              // Fallback cards while loading
              [
                { name: 'Starter Tier', price: 29, desc: 'Ideal for single-location workshops & retail stores.' },
                { name: 'Professional Tier', price: 79, desc: 'For growing multi-department businesses.', popular: true },
                { name: 'Enterprise Cloud', price: 199, desc: 'Dedicated infrastructure with full 15-module access.' }
              ].map((p, i) => (
                <div key={i} className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border ${p.popular ? 'border-indigo-600 shadow-xl shadow-indigo-600/10' : 'border-slate-200 dark:border-slate-800'} space-y-5 flex flex-col justify-between`}>
                  <div>
                    {p.popular && <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2.5 py-0.5 rounded-md">Most Popular</span>}
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">{p.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{p.desc}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-black text-slate-900 dark:text-white">${isAnnual ? (p.price * ((100 - annualDiscount) / 100)).toFixed(0) : p.price}</span>
                      <span className="text-xs text-slate-400">/ month</span>
                    </div>
                  </div>
                  <Link href="/order" className="w-full text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-bold transition-all shadow-sm shadow-indigo-600/25">
                    Select Plan
                  </Link>
                </div>
              ))
            ) : (
              packages.map((plan) => {
                const isPro = plan.package_key === 'pro' || plan.name.toLowerCase().includes('pro');
                const basePrice = parseFloat(plan.monthly_price || '0');
                const finalPrice = isAnnual 
                  ? (plan.yearly_price ? (parseFloat(plan.yearly_price) / 12).toFixed(0) : (basePrice * ((100 - annualDiscount) / 100)).toFixed(0))
                  : basePrice.toFixed(0);

                return (
                  <div
                    key={plan.id}
                    className={`relative p-6 rounded-2xl bg-white dark:bg-slate-900 border flex flex-col justify-between transition-all ${
                      isPro
                        ? 'border-indigo-600 dark:border-indigo-500 shadow-xl shadow-indigo-600/10'
                        : 'border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      {isPro && (
                        <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2.5 py-0.5 rounded-md mb-2">
                          Most Popular
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {plan.name}
                      </h3>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-black text-slate-900 dark:text-white">
                          ${finalPrice}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">/ month</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {plan.server_info || 'Enterprise Cloud Container'}
                      </p>

                      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Included Features</span>
                        {plan.features && Array.isArray(plan.features) ? (
                          plan.features.slice(0, 5).map((f: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                              <Check size={14} className="text-emerald-500 shrink-0" />
                              <span>{f.feature_name || f}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                            <Check size={14} className="text-emerald-500 shrink-0" />
                            <span>15 Integrated ERP Modules</span>
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
                        <span>Deploy This Plan</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </section>

      {/* ── 5. ENTERPRISE METRICS ─────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">15+</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Integrated Modules</div>
            </div>
            <div className="space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">99.9%</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Cloud Uptime SLA</div>
            </div>
            <div className="space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">&lt;2ms</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">API Execution Speed</div>
            </div>
            <div className="space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">500+</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Businesses</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. BOTTOM HIGH-IMPACT CTA ─────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-b from-slate-50 to-indigo-50/40 dark:from-slate-950 dark:to-indigo-950/20">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Ready to unleash your business potential?
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Join hundreds of modern businesses running on BizzFlow. Get your dedicated instance provisioned in under 60 seconds.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/order"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-8 py-4 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-600/30 group"
            >
              <span>Start Your Free 14-Day Trial</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/pricing"
              className="w-full sm:w-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-8 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Compare All Plans
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
