"use client";

import React, { useState } from 'react';
import { 
  BarChart3, Truck, Zap, ShoppingCart, Factory, Globe, Users, Sparkles, Store, 
  Smartphone, Building2, Music, Wallet, Layers, ArrowRight, Check, ShieldCheck 
} from 'lucide-react';
import Link from 'next/link';

const ALL_FEATURES = [
  // Workshop & Operations
  { id: 'coreFeatures', name: 'Executive Dashboards & BI', category: 'Operations', desc: 'Real-time telemetry, branch KPI comparisons, revenue trends & executive insights.', icon: BarChart3, color: 'from-blue-500 to-indigo-600', highlights: ['Real-time KPI graphs', 'Multi-location consolidation', 'Role-based view filters'] },
  { id: 'fleet', name: 'Fleet & Repair OS', category: 'Operations', desc: 'Complete automotive garage and repair order lifecycle with technician bay tracking.', icon: Truck, color: 'from-blue-600 to-cyan-600', highlights: ['Digital job cards & diagnostics', 'Bay & technician schedules', 'Automated customer SMS'] },
  { id: 'inventory', name: 'Inventory & Stock Intel', category: 'Operations', desc: 'Multi-warehouse stock, serial & batch numbers, barcode scanning & automated GRN.', icon: Zap, color: 'from-amber-500 to-orange-600', highlights: ['Barcode & batch tracking', 'Stock transfer workflows', 'Automated reorder triggers'] },
  { id: 'vendors', name: 'Vendor & Procurement Hub', category: 'Operations', desc: 'Manage supplier directories, purchase invoices, price comparison & returns.', icon: ShoppingCart, color: 'from-emerald-500 to-teal-600', highlights: ['Purchase order approvals', 'Goods Received Notes (GRN)', 'Supplier payment ledger'] },
  { id: 'production', name: 'Manufacturing & Assembly', category: 'Operations', desc: 'Multi-level Bill of Materials (BOM), production routing, scrap rates & costing.', icon: Factory, color: 'from-stone-500 to-zinc-600', highlights: ['Multi-level BOM recipes', 'Workstation capacity planning', 'Finished goods transfer'] },

  // Sales & Growth
  { id: 'sales', name: 'Sales & PDF Invoicing', category: 'Sales & Growth', desc: 'Instant quotes, pro-forma invoices, custom tax templates & automated recurring bills.', icon: Globe, color: 'from-indigo-500 to-purple-600', highlights: ['One-click invoice conversion', 'Multi-currency invoicing', 'Automated overdue reminders'] },
  { id: 'crm', name: 'CRM & Customer Leads', category: 'Sales & Growth', desc: 'Customer 360-degree timeline, service logs, lead scoring & direct communication.', icon: Users, color: 'from-violet-500 to-fuchsia-600', highlights: ['Customer 360 timeline', 'Service warranty records', 'Lead conversion tracking'] },
  { id: 'marketing', name: 'Promotions & Discounts', category: 'Sales & Growth', desc: 'Create percentage discounts, seasonal coupon codes, voucher cards & bulk promos.', icon: Sparkles, color: 'from-pink-500 to-rose-600', highlights: ['Coupon code generator', 'Tiered discount triggers', 'Promotional SMS blasts'] },
  { id: 'ecommerce', name: 'E-commerce Storefront', category: 'Sales & Growth', desc: 'Sell online directly with real-time stock sync and instant web order fulfillment.', icon: Store, color: 'from-sky-500 to-blue-600', highlights: ['Online product catalog', 'Live stock deduction', 'Payment gateway integration'] },
  { id: 'kiosk', name: 'Touchscreen Self-Service Kiosks', category: 'Sales & Growth', desc: 'Self-checkout tablets and guest arrival kiosks for seamless high-speed check-ins.', icon: Smartphone, color: 'from-teal-500 to-emerald-600', highlights: ['Touch-optimized UI', 'Self-order digital queue', 'Silent thermal printing'] },

  // Hospitality & Events
  { id: 'frontOffice', name: 'Front Office & Hotel OS', category: 'Hospitality', desc: 'Room reservation grid, guest folios, keycard management & night audit reports.', icon: Building2, color: 'from-amber-600 to-amber-700', highlights: ['Room occupancy visual grid', 'Check-in / check-out folios', 'Night audit automation'] },
  { id: 'banquet', name: 'Banquet & Event Management', category: 'Hospitality', desc: 'Venue hall booking, catering menus, seating plans & banquet contracts.', icon: Music, color: 'from-rose-500 to-red-600', highlights: ['Hall availability calendar', 'Menu & catering builder', 'Event invoice scheduling'] },

  // Finance & Governance
  { id: 'accounting', name: 'Accounting & General Ledger', category: 'Finance', desc: 'Compliant double-entry bookkeeping, Chart of Accounts, P&L, balance sheets & tax.', icon: Wallet, color: 'from-emerald-600 to-green-700', highlights: ['Automatic journal posting', 'P&L and Balance Sheet', 'Bank reconciliation'] },
  { id: 'hrm', name: 'Human Resources & Payroll', category: 'Finance', desc: 'Employee profiles, biometric shift attendance, leaves & automated salary slips.', icon: Users, color: 'from-cyan-600 to-blue-700', highlights: ['Biometric attendance logs', 'Leave policy calculations', 'One-click payroll generation'] },
  { id: 'masterData', name: 'Master Data & Governance', category: 'Finance', desc: 'Company parameters, tax rates, branch definitions & full security audit trails.', icon: Layers, color: 'from-slate-600 to-gray-700', highlights: ['Tax formula manager', 'Role-based access rules', 'Detailed audit logs'] },
];

export default function FeaturesPage() {
  const [selectedCat, setSelectedCat] = useState<'All' | 'Operations' | 'Sales & Growth' | 'Hospitality' | 'Finance'>('All');

  const filtered = selectedCat === 'All' 
    ? ALL_FEATURES 
    : ALL_FEATURES.filter(f => f.category === selectedCat);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pt-28 pb-24 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3.5 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Layers size={13} /> Complete 15-Module Enterprise Suite
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Integrated modules for every department.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Every module in BizzFlow is connected to a single core engine. No more duplicate data entry or synchronization headaches.
          </p>

          {/* Category Filter */}
          <div className="pt-4 flex items-center justify-center gap-2 flex-wrap">
            {(['All', 'Operations', 'Sales & Growth', 'Hospitality', 'Finance'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCat === cat
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800'
                }`}
              >
                {cat === 'All' ? 'All 15 Modules' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 hover:border-indigo-500/50 hover:shadow-xl transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${m.color} text-white shadow-sm group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {m.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {m.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                      {m.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    {m.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <Check size={13} className="text-emerald-500 shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href="/order"
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-600 dark:hover:text-white py-2 text-xs font-bold transition-all"
                  >
                    <span>Deploy Module</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Banner */}
        <div className="rounded-2xl bg-indigo-600 p-8 sm:p-12 text-center text-white space-y-4 shadow-xl shadow-indigo-600/20">
          <h2 className="text-2xl sm:text-3xl font-extrabold">
            Ready to integrate all your departments?
          </h2>
          <p className="text-sm text-indigo-100 max-w-lg mx-auto">
            Get your dedicated cloud instance with full module access. 14 days free, no credit card required.
          </p>
          <div className="pt-2">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors shadow-md"
            >
              <span>Get Started Now</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
