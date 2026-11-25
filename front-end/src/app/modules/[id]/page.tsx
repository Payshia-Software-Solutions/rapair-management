"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Search, LayoutGrid } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { APP_MODULES } from "@/components/odoo-app-launcher";
import { usePermissions } from "@/hooks/use-permissions";
import {
  NavItem, mainNavItems, serviceCenterItems, kioskItems, vendorItems, inventoryItems, crmItems,
  marketingItems, loyaltyItems, salesItems, masterDataItems, accountingItems, productionItems,
  hrmItems, frontOfficeItems, banquetItems, ecommerceItems,
} from "@/lib/nav-items";

// Which sidebar pages belong to each launcher module
const MODULE_PAGES: Record<string, NavItem[]> = {
  coreFeatures: mainNavItems,
  fleet: serviceCenterItems,
  inventory: inventoryItems,
  vendors: vendorItems,
  production: productionItems,
  sales: salesItems,
  crm: crmItems,
  marketing: marketingItems,
  loyalty: loyaltyItems,
  ecommerce: ecommerceItems,
  kiosk: kioskItems,
  frontOffice: frontOfficeItems,
  banquet: banquetItems,
  accounting: accountingItems,
  hrm: hrmItems,
  masterData: masterDataItems,
};

export default function ModulePage() {
  const { id } = useParams<{ id: string }>();
  const { permissions, loading } = usePermissions();
  const [q, setQ] = useState("");

  const mod = APP_MODULES.find((m) => m.id === id);
  const pages = useMemo(() => {
    const all = MODULE_PAGES[id] || [];
    const can = (p?: string) => !p || permissions.includes("*") || permissions.includes(p);
    const s = q.trim().toLowerCase();
    return all.filter((p) => can(p.perm) && (!s || p.label.toLowerCase().includes(s)));
  }, [id, permissions, q]);

  if (!mod) {
    return (
      <DashboardLayout title="Module">
        <div className="p-10 text-center space-y-4">
          <p className="text-muted-foreground">This module does not exist.</p>
          <Link href="/" className="text-primary font-semibold">Go home</Link>
        </div>
      </DashboardLayout>
    );
  }

  const Icon = mod.icon;
  const total = (MODULE_PAGES[id] || []).length;

  return (
    <DashboardLayout title={mod.name}>
      <div className="w-full space-y-6">
        {/* Module header */}
        <div className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
          <div className={`absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br ${mod.color} opacity-10 blur-3xl`} />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${mod.color} shadow-lg`}>
              <Icon className="h-8 w-8" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{mod.category}</div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{mod.name}</h1>
              <p className="text-sm text-muted-foreground">{mod.description}</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-xl border bg-background px-4 py-2 text-center">
                <div className="text-xl font-black">{loading ? "…" : pages.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Your pages</div>
              </div>
              <div className="rounded-xl border bg-background px-4 py-2 text-center">
                <div className="text-xl font-black">{total}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">In module</div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <Link href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("open-app-launcher")); }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> All modules
          </Link>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${mod.name} pages…`}
              className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        {/* Pages */}
        {loading ? null : pages.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
            <LayoutGrid className="mx-auto mb-3 h-8 w-8 opacity-50" />
            {q ? "No page matches your search." : "You don't have access to any page in this module."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {pages.map((p) => {
              const PIcon = p.icon;
              return (
                <Link key={p.href} href={p.href} target={p.newTab ? "_blank" : undefined}
                  className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <PIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.href}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
