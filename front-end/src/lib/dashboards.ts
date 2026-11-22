import { useEffect, useState } from "react";

/**
 * The dashboards a company can open on after login. `module` is the SaaS module that must be
 * licensed for the dashboard to be offered (null = always available).
 * The choice is stored as system setting `home_dashboard`.
 */
export type DashboardKey =
  | "overall" | "sales" | "pos" | "accounting" | "workshop" | "bays" | "front-office" | "banquet";

export interface DashboardOption {
  key: DashboardKey;
  label: string;
  description: string;
  href: string;
  module: string | null;
  /** Permission a user needs to open it; users without it fall back to the overview. */
  perm?: string;
}

export const DASHBOARDS: DashboardOption[] = [
  { key: "overall", label: "Business overview", description: "Revenue, stock and every licensed module at a glance", href: "/dashboard/overall", module: null },
  { key: "sales", label: "Sales", description: "Revenue, collections, payment methods and top items", href: "/dashboard/sales", module: "sales" },
  { key: "pos", label: "POS", description: "Open the point of sale straight away", href: "/cms/pos", module: "sales", perm: "pos.read" },
  { key: "accounting", label: "Accounting", description: "Income, expenses and quick links to the books", href: "/accounting", module: "accounting", perm: "accounting.read" },
  { key: "workshop", label: "Workshop", description: "Repair orders, throughput and urgent jobs", href: "/dashboard", module: "fleet" },
  { key: "bays", label: "Service bays", description: "Live board of bay occupancy", href: "/dashboard/bays", module: "fleet" },
  { key: "front-office", label: "Front office", description: "Room rack and guest status", href: "/front-office/dashboard", module: "frontOffice" },
  { key: "banquet", label: "Banquet", description: "Upcoming events and bookings", href: "/banquet/dashboard", module: "banquet" },
];

export const HOME_DASHBOARD_SETTING = "home_dashboard";
export const DEFAULT_DASHBOARD: DashboardKey = "overall";

// Same aliases the sidebar uses (components/dashboard-layout.tsx).
const MODULE_ALIASES: Record<string, string[]> = {
  fleet: ["serviceCenter"], serviceCenter: ["fleet"],
  marketing: ["promotions"], promotions: ["marketing"],
  crm: ["cms"], cms: ["crm"],
  ecommerce: ["storefront"], frontOffice: ["hotel"],
  accounting: ["finance"],
};

export function moduleAllowed(modules: string[] | null, module: string | null): boolean {
  if (!module) return true;
  if (!modules) return false;
  if (modules.includes("*") || modules.includes(module)) return true;
  return (MODULE_ALIASES[module] || []).some((a) => modules.includes(a));
}

/** Licensed modules: from the sidebar's cache when present, else the public SaaS config. */
export async function loadSaasModules(): Promise<string[] | null> {
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem("saas_config_cache");
      if (cached) {
        const m = JSON.parse(cached)?.modules;
        if (Array.isArray(m)) return m;
      }
    } catch {}
  }
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/saas/config`);
    const data = await res.json();
    return Array.isArray(data?.data?.modules) ? data.data.modules : null;
  } catch {
    return null;
  }
}

export function dashboardByKey(key: string | null | undefined): DashboardOption | undefined {
  return DASHBOARDS.find((d) => d.key === key);
}

/** Client hook: licensed modules (null while loading; ["*"] if the config can't be read). */
export function useSaasModules(): string[] | null {
  const [m, setM] = useState<string[] | null>(null);
  useEffect(() => { void loadSaasModules().then((x) => setM(x ?? ["*"])); }, []);
  return m;
}
