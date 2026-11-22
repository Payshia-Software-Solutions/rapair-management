"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, CheckCircle2, Clock, CreditCard, Users, MapPin, RefreshCw, Copy, Check,
  AlertTriangle, AlertCircle, Mail, ExternalLink, Download, ChevronDown, KeyRound,
  Sparkles, Zap, FileText, ArrowUpRight, Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ------------------------------------------------------------------ data helpers

type SaasModule = string;
type SaasConfig = {
  tenant_name?: string; package_name?: string; name?: string; package_key?: string;
  status?: string; monthly_price?: number | string; yearly_price?: number | string; price?: number | string;
  billing_cycle?: "monthly" | "yearly" | string;
  renewal_date?: string | null; trial_expiry?: string | null;
  max_users?: number | string | null; max_locations?: number | string | null;
  license_key?: string; api_connected?: boolean;
  modules?: SaasModule[] | string;
  invoices?: Array<{ invoice_number: string; amount: string | number; status: string; due_date: string }>;
};
type Usage = { users: number; locations: number; max_users: number | null; max_locations: number | null };

const MODULES = [
  { id: "coreFeatures", label: "Core Features", aliases: ["coreFeatures", "core"], desc: "Dashboards, reports, AI insights" },
  { id: "fleet", label: "Fleet & Service", aliases: ["fleet", "serviceCenter"], desc: "Repair orders, bays, technicians" },
  { id: "vendors", label: "Vendors", aliases: ["vendors", "suppliers"], desc: "Suppliers, POs, GRN, payments" },
  { id: "inventory", label: "Inventory", aliases: ["inventory", "stock"], desc: "Stock ledger, barcodes, transfers" },
  { id: "crm", label: "CRM", aliases: ["crm", "cms"], desc: "Customers, leads, vehicle registry" },
  { id: "sales", label: "Sales & Invoicing", aliases: ["sales", "invoicing"], desc: "Quotations, invoices, receipts" },
  { id: "marketing", label: "Marketing", aliases: ["marketing", "promotions"], desc: "Discounts, SMS and email campaigns" },
  { id: "ecommerce", label: "E-commerce", aliases: ["ecommerce", "storefront"], desc: "Online store, order fulfilment" },
  { id: "kiosk", label: "Self-service Kiosk", aliases: ["kiosk", "kioskApp"], desc: "Customer check-in, bookings" },
  { id: "accounting", label: "Accounting", aliases: ["accounting", "finance"], desc: "General ledger, balance sheet, costing" },
  { id: "production", label: "Production", aliases: ["production", "manufacturing"], desc: "BOM, production orders, work stations" },
  { id: "hrm", label: "Human Resources", aliases: ["hrm", "hr"], desc: "Employees, attendance, payroll" },
  { id: "frontOffice", label: "Front Office", aliases: ["frontOffice", "hotel"], desc: "Rooms, reservations, rates" },
  { id: "banquet", label: "Banquet & Events", aliases: ["banquet", "events"], desc: "Hall bookings, event menus" },
  { id: "masterData", label: "Master Data", aliases: ["masterData", "master_data"], desc: "Products, taxes, units" },
];

const money = (n: number | string | null | undefined, cur = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

const daysBetween = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso); const now = new Date();
  d.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
};

const asModuleList = (m?: SaasConfig["modules"]): string[] => {
  if (!m) return [];
  if (Array.isArray(m)) return m;
  if (m === "*" || m.includes("*")) return ["*"];
  if (m.startsWith("[")) { try { return JSON.parse(m); } catch { /* fall through */ } }
  return m.split(",").map(s => s.trim()).filter(Boolean);
};

// ------------------------------------------------------------------ small building blocks

function StatTile({ label, value, sub, icon, tone = "default" }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  icon?: React.ReactNode; tone?: "default" | "warn" | "danger";
}) {
  const t = tone === "danger" ? "border-red-500/30 bg-red-500/5"
          : tone === "warn" ? "border-amber-500/30 bg-amber-500/5"
          : "bg-card";
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${t}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        {icon && <div className="shrink-0 text-muted-foreground" aria-hidden="true">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-foreground">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function UsageBar({ used, max, label, tone }: { used: number; max: number | null; label: string; tone?: "warn" | "danger" }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = tone === "danger" ? "bg-red-500" : tone === "warn" ? "bg-amber-500" : "bg-primary";
  const text = max ? `${used} of ${max}` : `${used} (unlimited)`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{text}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuemin={0}
        aria-valuemax={max ?? used}
        aria-valuenow={used}
      >
        {max && <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}

function Section({ title, description, action, children }: {
  title: string; description?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ page

export default function SubscriptionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saas, setSaas] = useState<SaasConfig | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plans, setPlans] = useState<Array<{ id: number; name: string; package_key: string; monthly_price?: string | number; yearly_price?: string | number; modules?: SaasModule[] | string; max_users?: number | string | null; max_locations?: number | string | null }>>([]);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [updating, setUpdating] = useState(false);
  const [confirmSwap, setConfirmSwap] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  const load = async (force = false) => {
    try {
      const [cfgRes, usageRes, pkgRes] = await Promise.all([
        fetch(`${apiBase}/api/saas/${force ? "sync" : "config"}`).then(r => r.json()).catch(() => null),
        api("/api/saas/usage").then(r => r.json()).catch(() => null),
        fetch(`${apiBase}/api/saas/packages`).then(r => r.json()).catch(() => null),
      ]);
      if (cfgRes?.status === "success") {
        setSaas(cfgRes.data);
        // Share with the sidebar/dashboards (same localStorage key the layout reads) and nudge it to refresh
        try {
          window.localStorage.setItem("saas_config_cache", JSON.stringify(cfgRes.data));
          window.localStorage.setItem("saas_config_cache_time", String(Date.now()));
        } catch { /* storage may be blocked */ }
        if (force) window.dispatchEvent(new Event("saas:updated"));
      }
      if (usageRes?.status === "success") setUsage(usageRes.data);
      if (pkgRes?.status === "success") setPlans((pkgRes.data || []) as never);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const refresh = async () => {
    setSyncing(true);
    try { await load(true); toast({ title: "Latest subscription details loaded" }); }
    finally { setSyncing(false); }
  };

  const copyKey = async () => {
    if (!saas?.license_key) return;
    try {
      await navigator.clipboard.writeText(saas.license_key);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  const changeLicense = async () => {
    if (!newKey.trim()) return;
    if (!confirmSwap) { setConfirmSwap(true); return; }
    setUpdating(true);
    try {
      const res = await api("/api/saas/update-license", { method: "POST", body: JSON.stringify({ license_key: newKey.trim() }) });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "Update failed");
      toast({ title: "Licence changed", description: "Loading the new subscription…" });
      setNewKey(""); setConfirmSwap(false); setChangeOpen(false);
      await load(true);
    } catch (e: unknown) {
      toast({ title: "Could not change licence", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setUpdating(false); }
  };

  // ---- derived values
  const expiry = saas?.renewal_date || saas?.trial_expiry || null;
  const daysLeft = daysBetween(expiry);
  const trial = (saas?.status || "").toLowerCase() === "trial";
  const connected = saas?.api_connected !== false;

  const cycle = (saas?.billing_cycle || "monthly").toLowerCase();
  const perMonth = Number(saas?.monthly_price ?? saas?.price ?? 0);
  const perYear = Number(saas?.yearly_price ?? perMonth * 12);
  const priceNow = cycle === "yearly" ? perYear : perMonth;
  const priceLabel = cycle === "yearly" ? "year" : "month";

  const modules = asModuleList(saas?.modules);
  const hasAll = modules.includes("*");
  const isIncluded = (m: typeof MODULES[number]) =>
    hasAll || m.aliases.some(a => modules.some(x => x.toLowerCase() === a.toLowerCase()));
  const includedCount = MODULES.filter(isIncluded).length;

  const uUsers = usage?.users ?? 0;
  const uLocs = usage?.locations ?? 0;
  const maxUsers = saas?.max_users != null ? Number(saas.max_users) : null;
  const maxLocs = saas?.max_locations != null ? Number(saas.max_locations) : null;
  const usersTone: "warn" | "danger" | undefined =
    maxUsers && uUsers / maxUsers >= 1 ? "danger" : maxUsers && uUsers / maxUsers >= 0.9 ? "warn" : undefined;
  const locsTone: "warn" | "danger" | undefined =
    maxLocs && uLocs / maxLocs >= 1 ? "danger" : maxLocs && uLocs / maxLocs >= 0.9 ? "warn" : undefined;

  const expiryTone: "warn" | "danger" | undefined =
    daysLeft != null && daysLeft < 0 ? "danger" : daysLeft != null && daysLeft <= 14 ? "warn" : undefined;
  const expiryWord = daysLeft != null ? (daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : daysLeft === 0 ? "today" : `in ${daysLeft} days`) : "—";

  const supportEmail = "support@nebulync.com";
  const portalUrl = "https://bizzflow.nebulync.com";

  const upgradePlans = useMemo(
    () => plans.filter(p => (p.name || "").toLowerCase() !== (saas?.package_name || saas?.name || "").toLowerCase()),
    [plans, saas]
  );

  // ------------------------------------------------------------------ render

  if (loading) {
    return (
      <DashboardLayout title="Subscription & Billing">
        <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading your subscription…
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Subscription & Billing">
      <div className="w-full space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Subscription & Billing</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your plan, usage, invoices and support.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`gap-1.5 ${connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} aria-hidden="true" />
              {connected ? "Live" : "Offline"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={syncing} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
              {syncing ? "Syncing" : "Sync now"}
            </Button>
          </div>
        </header>

        {/* Alerts */}
        {!connected && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold text-red-700 dark:text-red-300">Can&apos;t reach the licence server</p>
              <p className="text-red-600/80 dark:text-red-300/80">
                Showing cached subscription details. Checks resume automatically when the connection is back.
              </p>
            </div>
          </div>
        )}
        {expiryTone && (
          <div role="alert" className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${expiryTone === "danger" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${expiryTone === "danger" ? "text-red-600" : "text-amber-600"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              <p className={`font-semibold ${expiryTone === "danger" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                {expiryTone === "danger" ? (trial ? "Your trial has ended" : "Your subscription has lapsed") : trial ? `Trial ends ${expiryWord}` : `Renews ${expiryWord}`}
              </p>
              <p className={expiryTone === "danger" ? "text-red-600/80 dark:text-red-300/80" : "text-amber-600/80 dark:text-amber-300/80"}>
                {expiryTone === "danger"
                  ? "Some features may be read-only. Contact support to continue using BizzFlow."
                  : `Make sure your payment method is up to date. Expires ${fmtDate(expiry)}.`}
              </p>
            </div>
            <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Renew ${saas?.tenant_name || ""}`)}`}
               className="inline-flex shrink-0 items-center gap-1 rounded-md border border-current px-2.5 py-1 text-xs font-semibold">
              <Mail className="h-3 w-3" /> Contact
            </a>
          </div>
        )}

        {/* Status strip */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Current plan"
            value={saas?.package_name || saas?.name || "—"}
            sub={<span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{(saas?.status || "active").toString()}</span>}
            icon={<Sparkles className="h-4 w-4" />}
          />
          <StatTile
            label={cycle === "yearly" ? "Billed yearly" : "Billed monthly"}
            value={<span>{money(priceNow)}<span className="ml-1 text-xs font-semibold text-muted-foreground">/{priceLabel}</span></span>}
            sub={expiry ? `Next charge ${fmtDate(expiry)}` : "No upcoming charge"}
            icon={<CreditCard className="h-4 w-4" />}
          />
          <div className={`rounded-2xl border p-4 sm:p-5 ${usersTone === "danger" ? "border-red-500/30 bg-red-500/5" : usersTone === "warn" ? "border-amber-500/30 bg-amber-500/5" : "bg-card"}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Users</div>
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
            <UsageBar used={uUsers} max={maxUsers} label="Active users" tone={usersTone} />
          </div>
          <div className={`rounded-2xl border p-4 sm:p-5 ${locsTone === "danger" ? "border-red-500/30 bg-red-500/5" : locsTone === "warn" ? "border-amber-500/30 bg-amber-500/5" : "bg-card"}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Locations</div>
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
            <UsageBar used={uLocs} max={maxLocs} label="Branches / sites" tone={locsTone} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
          {/* Left: what's included + billing history */}
          <div className="space-y-6">
            <Section
              title={`What's included (${includedCount} of ${MODULES.length})`}
              description="Modules turned on for your workspace. Not-included ones are hidden from menus."
            >
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {MODULES.map((m) => {
                  const on = isIncluded(m);
                  return (
                    <li key={m.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${on ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-dashed border-border bg-muted/30 opacity-70"}`}>
                      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${on ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{m.label}</div>
                        <div className="truncate text-xs text-muted-foreground">{on ? m.desc : "Not in your plan"}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section
              title="Billing history"
              description="Invoices for your subscription. Workspace sales invoices are separate."
              action={
                saas?.invoices && saas.invoices.length > 0 ? (
                  <Button variant="outline" size="sm" asChild><a href={portalUrl} target="_blank" rel="noreferrer" className="gap-2"><Download className="h-3.5 w-3.5" />Download all</a></Button>
                ) : null
              }
            >
              {saas?.invoices && saas.invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 text-left font-semibold">Invoice</th>
                        <th className="py-2 text-left font-semibold">Date</th>
                        <th className="py-2 text-right font-semibold">Amount</th>
                        <th className="py-2 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {saas.invoices.map((inv, i) => (
                        <tr key={`${inv.invoice_number}-${i}`} className="hover:bg-muted/40">
                          <td className="py-3"><span className="inline-flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /><span className="font-mono text-xs font-semibold">{inv.invoice_number}</span></span></td>
                          <td className="py-3 text-xs text-muted-foreground">{fmtDate(inv.due_date)}</td>
                          <td className="py-3 text-right font-semibold tabular-nums">{money(inv.amount)}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${inv.status === "Paid" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : inv.status === "Overdue" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                              {inv.status === "Paid" && <CheckCircle2 className="h-3 w-3" />}
                              {inv.status === "Overdue" && <AlertTriangle className="h-3 w-3" />}
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold">No invoices yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                    Invoices appear here after your {trial ? "trial ends and billing starts" : "next billing cycle runs"}.
                  </p>
                </div>
              )}
            </Section>
          </div>

          {/* Right: renewal + licence + support */}
          <aside className="space-y-6">
            <Section title="Renewal">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className={`h-4 w-4 ${expiryTone === "danger" ? "text-red-500" : expiryTone === "warn" ? "text-amber-500" : "text-muted-foreground"}`} aria-hidden="true" />
                  <span className="font-semibold">{trial ? "Trial ends" : "Renews"} {expiryWord}</span>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">{trial ? "End date" : "Renewal date"}</span>
                    <span className="font-semibold">{fmtDate(expiry)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">{money(priceNow)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Billed to</span>
                    <span className="truncate pl-2 font-semibold">{saas?.tenant_name || "—"}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="w-full justify-between gap-2">
                  <a href={portalUrl} target="_blank" rel="noreferrer">
                    Manage payment method <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </Section>

            <Section title="Licence key" description="Identifies your workspace to the licence server. Treat it as a password.">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-2.5 py-2 font-mono text-[11px]">
                    {saas?.license_key || "—"}
                  </code>
                  <Button variant="outline" size="icon" onClick={() => void copyKey()} disabled={!saas?.license_key} aria-label="Copy licence key" className="shrink-0">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  </Button>
                </div>
                <details open={changeOpen} onToggle={(e) => setChangeOpen((e.currentTarget as HTMLDetailsElement).open)} className="group rounded-xl border">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" />Switch licence (advanced)</span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="space-y-3 border-t p-3">
                    <p className="text-xs text-muted-foreground">
                      Pasting another licence key links this workspace to that account&apos;s subscription. Only do this if your provider told you to.
                    </p>
                    <label className="block text-xs font-semibold" htmlFor="newKey">New activation key</label>
                    <Input id="newKey" value={newKey} onChange={(e) => { setNewKey(e.target.value); setConfirmSwap(false); }}
                           placeholder="NX-…" className="font-mono text-xs" />
                    {confirmSwap && (
                      <p role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
                        Click Change licence again to confirm. Your current licence will be replaced.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant={confirmSwap ? "destructive" : "default"}
                              onClick={() => void changeLicense()} disabled={updating || !newKey.trim()} className="gap-2">
                        {updating && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                        {confirmSwap ? "Yes, change licence" : "Change licence"}
                      </Button>
                      {confirmSwap && <Button size="sm" variant="ghost" onClick={() => setConfirmSwap(false)}>Cancel</Button>}
                    </div>
                  </div>
                </details>
              </div>
            </Section>

            <Section title="Support">
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground">Need to upgrade, add users, or ask a question? We&apos;re here to help.</p>
                <Button variant="outline" size="sm" asChild className="w-full justify-between gap-2">
                  <a href={`mailto:${supportEmail}?subject=${encodeURIComponent("BizzFlow support: " + (saas?.tenant_name || ""))}`}>
                    <span className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5" aria-hidden="true" />Email support</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="w-full justify-between gap-2">
                  <a href={portalUrl} target="_blank" rel="noreferrer">
                    <span className="inline-flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />Open customer portal</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </Section>
          </aside>
        </div>

        {/* Available plans */}
        {upgradePlans.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Change plan</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Switch to another plan to get more users, locations or modules.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {upgradePlans.map((p) => {
                const pm = asModuleList(p.modules);
                const all = pm.includes("*");
                const price = Number(p.monthly_price ?? 0);
                const higher = price > perMonth;
                return (
                  <motion.div key={p.id} whileHover={{ y: -2 }} className="flex flex-col rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{all ? "Full access" : `${pm.length} modules`}</div>
                      </div>
                      {higher && <Badge className="shrink-0 gap-1 bg-primary/10 text-primary"><Zap className="h-3 w-3" />Upgrade</Badge>}
                    </div>
                    <div className="mt-3 text-2xl font-black tabular-nums">
                      {money(price)}<span className="ml-1 text-xs font-semibold text-muted-foreground">/mo</span>
                    </div>
                    {(p.max_users || p.max_locations) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Up to {p.max_users || "∞"} users · {p.max_locations || "∞"} sites
                      </div>
                    )}
                    <Button size="sm" variant="outline" asChild className="mt-4 gap-2">
                      <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Switch ${saas?.tenant_name || ""} to ${p.name}`)}`}>
                        Request switch <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
