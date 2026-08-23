"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, MessageCircle, Mail, MapPin, ArrowUpRight, ShieldCheck } from "lucide-react";

export default function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin') || pathname.startsWith('/verify-email') || pathname.startsWith('/docs')) {
    return null;
  }

  const phoneDisplay = "0770 481 363";
  const phoneIntl = "+94770481363";
  const waUrl = `https://wa.me/94770481363?text=Hi%20BizzFlow%20Team%2C%20I%20would%20like%20to%20inquire%20about%20the%20ERP%20system`;

  return (
    <footer className="border-t border-slate-200/80 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-8 lg:gap-10 pb-12 border-b border-slate-200/80 dark:border-slate-800">
          
          {/* Brand Column (Span 2) */}
          <div className="sm:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3 group inline-flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm">
                <span className="font-black text-sm tracking-tighter">B</span>
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                  BIZZFLOW
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                    ERP
                  </span>
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Enterprise Platform</span>
              </div>
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              The next-generation modular business operating system. Unified inventory, repair operations, POS commerce, accounting, and HRM in one cloud workspace.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-3 py-1.5 rounded-xl w-fit">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational (99.9% Uptime)</span>
            </div>
          </div>

          {/* Column 1: Core Apps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">ERP Apps</h4>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Fleet & Repair OS</Link></li>
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Inventory & Stock</Link></li>
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Point of Sale (POS)</Link></li>
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">HRM & Payroll</Link></li>
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Accounting & COA</Link></li>
            </ul>
          </div>

          {/* Column 2: Solutions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Solutions</h4>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Automotive & Garage</Link></li>
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Retail & Supermarkets</Link></li>
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Hotels & Banquets</Link></li>
              <li><Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Manufacturing Plants</Link></li>
              <li><Link href="/pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Multi-Branch SaaS</Link></li>
            </ul>
          </div>

          {/* Column 3: Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Platform</h4>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li><Link href="/pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Pricing & Plans</Link></li>
              <li><Link href="/docs" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Documentation</Link></li>
              <li><Link href="/order" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Start Free Trial</Link></li>
              <li><Link href="/admin/login" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold text-indigo-600 dark:text-indigo-400">Staff & Admin Login</Link></li>
            </ul>
          </div>

          {/* Column 4: Direct Contact & Sales (Hotline & WhatsApp) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Get In Touch</h4>
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              
              {/* Phone Direct */}
              <a 
                href={`tel:${phoneIntl}`} 
                className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
              >
                <Phone size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="font-mono">{phoneDisplay}</span>
              </a>

              {/* WhatsApp Direct */}
              <a 
                href={waUrl}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors group"
              >
                <MessageCircle size={14} className="shrink-0" />
                <span>WhatsApp Sales</span>
                <ArrowUpRight size={12} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </a>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 leading-normal">
                Dedicated Enterprise Onboarding & Custom ERP Setup
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Strip */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} BizzFlow Enterprise Suite. Powered by Nebulync.</p>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Privacy Policy</Link>
            <Link href="/docs" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Terms of Service</Link>
            <Link href="/docs" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Security & SLA</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
