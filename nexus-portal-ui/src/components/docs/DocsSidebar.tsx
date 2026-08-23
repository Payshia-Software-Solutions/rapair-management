"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BookOpen, 
  Terminal, 
  Wrench, 
  CreditCard, 
  Boxes, 
  BarChart3, 
  Users, 
  FileText,
  Search,
  Menu,
  X,
  Layers,
  Sparkles,
  ShieldCheck,
  ChevronRight
} from "lucide-react";

interface SidebarLink {
  title: string;
  href: string;
  icon: React.ComponentType<any>;
}

interface SidebarGroup {
  category: string;
  links: SidebarLink[];
}

export default function DocsSidebar() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const sidebarGroups: SidebarGroup[] = [
    {
      category: "Getting Started",
      links: [
        { title: "Introduction & Core Architecture", href: "/docs", icon: BookOpen },
        { title: "Installation & Setup Guide", href: "/docs/getting-started", icon: Terminal },
      ],
    },
    {
      category: "Core ERP Modules",
      links: [
        { title: "Fleet OS & ServiceBay", href: "/docs/modules/repair-os", icon: Wrench },
        { title: "Point of Sale & Day Ledger", href: "/docs/modules/pos", icon: CreditCard },
        { title: "Inventory & FIFO Tracking", href: "/docs/modules/inventory", icon: Boxes },
        { title: "General Ledger & Accounting", href: "/docs/modules/accounting", icon: BarChart3 },
        { title: "HRM & Automated Payroll", href: "/docs/modules/hrm", icon: Users },
        { title: "Invoice & Billing Lifecycle", href: "/docs/modules/invoicing", icon: FileText },
      ],
    },
  ];

  const filteredGroups = sidebarGroups.map(group => ({
    ...group,
    links: group.links.filter(link => 
      link.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.links.length > 0);

  const renderContent = () => (
    <div className="space-y-6">
      
      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
        <input 
          type="text" 
          placeholder="Search documentation…" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-xs"
        />
      </div>

      {/* Navigation Groups */}
      <nav className="space-y-6">
        {filteredGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-2">
            <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3">
              {group.category}
            </h5>
            <div className="space-y-1">
              {group.links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive 
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 shadow-xs" 
                        : "text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon size={15} className={`shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                      <span className="truncate">{link.title}</span>
                    </div>
                    {isActive && <ChevronRight size={13} className="shrink-0 text-indigo-600 dark:text-indigo-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick Help Card */}
      <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-300">
          <ShieldCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span>Need Developer Support?</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Have questions regarding API integrations or enterprise deployment?
        </p>
        <Link 
          href="/order" 
          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Talk to Enterprise Team →
        </Link>
      </div>

    </div>
  );

  return (
    <>
      {/* Mobile Toggle Trigger */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 transition-all focus:outline-none ring-4 ring-indigo-600/20"
          aria-label="Toggle Docs Menu"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Desktop Sidebar Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        {renderContent()}
      </div>

      {/* Mobile Modal Drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 pt-24 shadow-2xl overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
}
