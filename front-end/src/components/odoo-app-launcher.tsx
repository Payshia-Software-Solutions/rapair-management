"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LayoutGrid, Search, X, ChevronRight, LayoutDashboard, Truck, Zap, ShoppingCart, 
  Factory, Globe, Users, Sparkles, Store, Smartphone, Wallet, Building2, Music, BarChart, Shield
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface AppLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  isModuleAllowed: (mod: string) => boolean;
}

interface AppTile {
  id: string;
  name: string;
  category: string;
  description: string;
  href: string;
  icon: any;
  color: string;
  badge?: string;
}

export const APP_MODULES: AppTile[] = [
  // Workshop & Operations
  { id: 'coreFeatures', name: 'Dashboards & BI', category: 'Operations', description: 'Executive KPIs, analytics & overview', href: '/dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-indigo-600 text-white' },
  { id: 'fleet', name: 'Fleet Management', category: 'Operations', description: 'Repair orders, bays, vehicles & jobs', href: '/fleet', icon: Truck, color: 'from-blue-600 to-cyan-600 text-white' },
  { id: 'inventory', name: 'Inventory & Stock', category: 'Operations', description: 'Stock ledger, GRN, transfers & items', href: '/inventory/items', icon: Zap, color: 'from-amber-500 to-orange-600 text-white' },
  { id: 'vendors', name: 'Vendor Hub', category: 'Operations', description: 'Suppliers, purchase invoices & orders', href: '/vendors/suppliers', icon: ShoppingCart, color: 'from-emerald-500 to-teal-600 text-white' },
  { id: 'production', name: 'Manufacturing', category: 'Operations', description: 'BOM, production orders & assembly', href: '/production/orders', icon: Factory, color: 'from-stone-500 to-zinc-600 text-white' },

  // Sales & Growth
  { id: 'sales', name: 'Sales & Invoicing', category: 'Sales & Growth', description: 'Customer invoices, quotes & receipts', href: '/sales/invoices', icon: Globe, color: 'from-indigo-500 to-purple-600 text-white' },
  { id: 'crm', name: 'CRM & Leads', category: 'Sales & Growth', description: 'Customer directory, inquiries & history', href: '/crm/customers', icon: Users, color: 'from-violet-500 to-fuchsia-600 text-white' },
  { id: 'marketing', name: 'Marketing & Promos', category: 'Sales & Growth', description: 'Discounts, campaigns & SMS triggers', href: '/marketing/discounts', icon: Sparkles, color: 'from-pink-500 to-rose-600 text-white' },
  { id: 'ecommerce', name: 'E-commerce Store', category: 'Sales & Growth', description: 'Online storefront catalog & web orders', href: '/ecommerce/orders', icon: Store, color: 'from-sky-500 to-blue-600 text-white' },
  { id: 'kiosk', name: 'Self-Service Kiosk', category: 'Sales & Growth', description: 'Guest check-in, self order displays', href: '/kiosk/dashboard', icon: Smartphone, color: 'from-teal-500 to-emerald-600 text-white' },

  // Hospitality
  { id: 'frontOffice', name: 'Front Office & Hotel', category: 'Hospitality', description: 'Room reservations, check-ins & rates', href: '/front-office/dashboard', icon: Building2, color: 'from-amber-600 to-amber-700 text-white' },
  { id: 'banquet', name: 'Banquet & Events', category: 'Hospitality', description: 'Hall bookings, menus & calendars', href: '/banquet/bookings', icon: Music, color: 'from-rose-500 to-red-600 text-white' },

  // Finance & Governance
  { id: 'accounting', name: 'Accounting & Ledger', category: 'Finance', description: 'COA, journal entries & balance sheet', href: '/accounting/chart-of-accounts', icon: Wallet, color: 'from-emerald-600 to-green-700 text-white' },
  { id: 'hrm', name: 'Human Resources (HR)', category: 'Finance', description: 'Employees, attendance, leaves & payroll', href: '/hrm/employees', icon: Users, color: 'from-cyan-600 to-blue-700 text-white' },
  { id: 'masterData', name: 'Master Data & Settings', category: 'Finance', description: 'Tax tables, units, specs & core data', href: '/master-data/services', icon: BarChart, color: 'from-slate-600 to-gray-700 text-white' },
];

export function AppLauncher({ isOpen, onClose, isModuleAllowed }: AppLauncherProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeModules = APP_MODULES.filter(m => isModuleAllowed(m.id));
  const filtered = activeModules.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.description.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(filtered.map(m => m.category)));

  const handleLaunch = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[#fafafa] dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <DialogTitle className="sr-only">App Launcher</DialogTitle>
        {/* Header with Search */}
        <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search ERP modules, apps, features... (e.g. Sales, Stock)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800/70 border-none pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
              ESC to close
            </span>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No matching apps found</p>
              <p className="text-xs text-slate-400">Try searching with a different keyword or category.</p>
            </div>
          ) : (
            categories.map((category) => {
              const catModules = filtered.filter(m => m.category === category);
              return (
                <div key={category} className="space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {catModules.map((mod) => {
                      const Icon = mod.icon;
                      return (
                        <button
                          key={mod.id}
                          onClick={() => handleLaunch(mod.href)}
                          className="group relative flex items-start gap-3.5 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:shadow-md transition-all text-left"
                        >
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${mod.color} shadow-sm group-hover:scale-105 transition-transform`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                                {mod.name}
                              </p>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-normal">
                              {mod.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100/60 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{activeModules.length}</span> active enterprise apps available
          </div>
          <span>BizzFlow App Matrix Hub</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}