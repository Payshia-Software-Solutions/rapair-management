"use client";

import { assetUrl } from '@/lib/asset-url';
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchCustomerSummary, fetchCustomerCheques, fetchCustomerStocks, updateCustomerStock, CONTENT_BASE_URL } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, ArrowLeft, Award, Calendar, Car, CreditCard, Edit2, ExternalLink, FileText, Gift, Hotel,
  Layers, Loader2, Mail, MapPin, MessageCircle, Package, Pencil, Phone, Plus, Printer, Receipt, RotateCcw,
  TrendingDown, TrendingUp, Wallet, Wrench, Clock, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown) => Number(v) || 0;
const money = (v: unknown) => `LKR ${num(v).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (v: unknown) => {
  const n = num(v);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
};
const date = (v?: string | null) => (v ? new Date(v.replace(" ", "T")).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const daysSince = (v?: string | null) => (v ? Math.floor((Date.now() - new Date(v.replace(" ", "T")).getTime()) / 86_400_000) : null);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  cleared: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  checkedout: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  accepted: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  partial: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  "in progress": "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  unpaid: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",
  overdue: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",
  bounced: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",
  cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-300",
  void: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-300",
};
function StatusBadge({ status }: { status?: string | null }) {
  const s = String(status || "—");
  return <Badge variant="outline" className={`text-[11px] font-semibold ${STATUS_TONE[s.toLowerCase()] ?? ""}`}>{s}</Badge>;
}

function Kpi({ label, value, sub, icon: Icon, tone = "text-foreground", trend }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ElementType; tone?: string; trend?: number | null;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className={`mt-2 text-xl font-bold tabular-nums ${tone}`}>{value}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {trend != null && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
          {sub}
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{text}</div>;
}

function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>{head.map((h, i) => <th key={i} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}
const td = "px-3 py-2.5 whitespace-nowrap";

type Activity = { at: string; kind: string; title: string; detail?: string; amount?: number; href?: string; icon: React.ElementType; tone: string };

export default function CustomerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [cheques, setCheques] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [itemQuery, setItemQuery] = useState("");

  const [stockUpdateModal, setStockUpdateModal] = useState<{ isOpen: boolean; stockId: number | null; currentSoldQty: number; maxQty: number }>({ isOpen: false, stockId: null, currentSoldQty: 0, maxQty: 0 });
  const [stockUpdateQty, setStockUpdateQty] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [summary, chequesData, stocksData] = await Promise.all([
          fetchCustomerSummary(id as string),
          fetchCustomerCheques(id as string).catch(() => []),
          fetchCustomerStocks(id as string).catch(() => []),
        ]);
        if (!alive) return;
        setData(summary);
        setCheques(Array.isArray(chequesData) ? chequesData : []);
        setStocks(Array.isArray(stocksData) ? stocksData : []);
      } catch (err: any) {
        toast({ title: "Could not load customer", description: err.message, variant: "destructive" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, toast]);

  const handleUpdateStockConfirm = async () => {
    const { stockId, maxQty } = stockUpdateModal;
    if (stockId === null) return;
    const q = parseFloat(stockUpdateQty);
    if (isNaN(q) || q < 0 || q > maxQty) {
      toast({ title: "Invalid quantity", description: `Enter a number from 0 to ${maxQty}.`, variant: "destructive" });
      return;
    }
    try {
      await updateCustomerStock(stockId, { sold_qty: q });
      setStocks(stocks.map(s => (s.id === stockId ? { ...s, sold_qty: q } : s)));
      toast({ title: "Sold quantity updated" });
      setStockUpdateModal({ ...stockUpdateModal, isOpen: false });
    } catch (err: any) {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    }
  };

  // ---- Derived data (safe when data is null)
  const d = data ?? {};
  const customer = d.customer ?? {};
  const stats = d.stats ?? {};
  const list = (k: string): any[] => (Array.isArray(d[k]) ? d[k] : []);
  const invoices = list("invoices"), payments = list("payments"), reservations = list("reservations");
  const items = list("purchased_items"), orders = list("orders"), vehicles = list("vehicles");
  const quotations = list("quotations"), returns = list("returns"), creditNotes = list("credit_notes");
  const vouchers = list("gift_vouchers"), methods = list("payment_methods");
  const loyalty = d.loyalty ?? null;

  const monthly = useMemo(() => {
    const byMonth = new Map<string, number>((Array.isArray(data?.monthly) ? data.monthly : []).map((m: any) => [m.month, num(m.total)]));
    const out: { month: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      out.push({ month: key, label: dt.toLocaleDateString("en-GB", { month: "short" }), total: byMonth.get(key) ?? 0 });
    }
    return out;
  }, [data]);

  const activity = useMemo<Activity[]>(() => {
    if (!data) return [];
    const a: Activity[] = [];
    for (const i of invoices) a.push({ at: i.created_at || i.issue_date, kind: "Invoice", title: `Invoice ${i.invoice_no}`, detail: i.status, amount: num(i.grand_total), href: `/cms/invoices/${i.id}/view`, icon: FileText, tone: "bg-indigo-500/10 text-indigo-600" });
    for (const p of payments) a.push({ at: p.created_at || p.payment_date, kind: "Payment", title: `Payment ${p.receipt_no}`, detail: `${p.payment_method || ""}${p.invoice_no ? ` · for ${p.invoice_no}` : ""}`, amount: num(p.amount), icon: Wallet, tone: "bg-emerald-500/10 text-emerald-600" });
    for (const o of orders) a.push({ at: o.created_at, kind: "Service", title: `Service order #${o.id}`, detail: [o.vehicle_identifier, o.status].filter(Boolean).join(" · "), href: `/orders/${o.id}`, icon: Wrench, tone: "bg-amber-500/10 text-amber-600" });
    for (const q of quotations) a.push({ at: q.issue_date, kind: "Quotation", title: `Quotation ${q.quotation_no}`, detail: q.status, amount: num(q.grand_total), href: `/sales/quotations/${q.id}`, icon: FileText, tone: "bg-sky-500/10 text-sky-600" });
    for (const r of returns) a.push({ at: r.return_date, kind: "Return", title: `Return ${r.return_no}`, detail: r.reason, amount: -num(r.total_amount), icon: RotateCcw, tone: "bg-rose-500/10 text-rose-600" });
    for (const c of creditNotes) a.push({ at: c.created_at || c.cn_date, kind: "Credit note", title: `Credit note ${c.cn_no}`, detail: c.reason, amount: -num(c.total), icon: Receipt, tone: "bg-rose-500/10 text-rose-600" });
    for (const r of reservations) a.push({ at: r.created_at || r.check_in, kind: "Stay", title: `Stay${r.room_no ? ` · Room ${r.room_no}` : ""}`, detail: `${date(r.check_in)} – ${date(r.check_out)}`, href: `/front-office/reservations/${r.id}`, icon: Hotel, tone: "bg-blue-500/10 text-blue-600" });
    return a.filter(x => x.at).sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading customer" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">This customer could not be loaded.</p>
          <Button variant="outline" onClick={() => router.push("/cms/customers")}>Back to customers</Button>
        </div>
      </DashboardLayout>
    );
  }

  const outstanding = num(stats.outstanding ?? customer.total_outstanding);
  const overdue = num(stats.overdue);
  const creditLimit = num(customer.credit_limit);
  const creditUse = creditLimit > 0 ? Math.min(100, (outstanding / creditLimit) * 100) : null;
  const lastVisit = daysSince(stats.last_purchase);
  const trend = num(stats.spent_prev_90d) > 0 ? ((num(stats.spent_90d) - num(stats.spent_prev_90d)) / num(stats.spent_prev_90d)) * 100 : null;
  const paidRatio = num(stats.total_spent) > 0 ? (num(stats.total_paid) / num(stats.total_spent)) * 100 : 100;
  const phoneDigits = String(customer.phone || "").replace(/\D/g, "");
  const waNumber = phoneDigits.startsWith("0") ? `94${phoneDigits.slice(1)}` : phoneDigits;
  const validEmail = /\S+@\S+\.\S+/.test(String(customer.email || ""));
  const custNo = `CUST-${String(customer.id).padStart(4, "0")}`;
  const member = loyalty?.member;
  const nextTier = member ? (loyalty.tiers || []).find((t: any) => num(t.threshold) > num(member.lifetime_points)) : null;
  const filteredItems = itemQuery ? items.filter(i => String(i.item_name).toLowerCase().includes(itemQuery.toLowerCase())) : items;

  // Segment: simple, explainable rules
  const segment = (() => {
    if (!stats.total_invoices) return { label: "New", tone: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300" };
    if (lastVisit != null && lastVisit > 180) return { label: "Dormant", tone: "bg-slate-500/10 text-slate-600 border-slate-500/30" };
    if (lastVisit != null && lastVisit > 90) return { label: "At risk", tone: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300" };
    if (num(stats.total_invoices) >= 10) return { label: "Loyal", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300" };
    return { label: "Active", tone: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-300" };
  })();

  const printIdCard = () => {
    const svg = document.getElementById("customer-qr-code");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    w.document.write(`<html><head><title>${esc(customer.name)}</title></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif">
      <h2 style="margin:0 0 4px">${esc(customer.name)}</h2><p style="margin:0 0 16px;color:#666">${custNo}</p>
      <img src="data:image/svg+xml;base64,${btoa(svgData)}" style="width:220px;height:220px"/>
      <script>window.onload=function(){window.print();window.close();}</script></body></html>`);
    w.document.close();
  };

  const tabs: { value: string; label: string; icon: React.ElementType; count: number; show: boolean }[] = [
    { value: "invoices", label: "Invoices", icon: FileText, count: invoices.length, show: true },
    { value: "payments", label: "Payments", icon: Wallet, count: payments.length, show: true },
    { value: "items", label: "Items", icon: Layers, count: items.length, show: true },
    { value: "orders", label: "Service", icon: Wrench, count: orders.length, show: orders.length > 0 },
    { value: "vehicles", label: "Vehicles", icon: Car, count: vehicles.length, show: vehicles.length > 0 },
    { value: "quotations", label: "Quotations", icon: FileText, count: quotations.length, show: quotations.length > 0 },
    { value: "returns", label: "Returns & credits", icon: RotateCcw, count: returns.length + creditNotes.length, show: returns.length + creditNotes.length > 0 },
    { value: "vouchers", label: "Gift vouchers", icon: Gift, count: vouchers.length, show: vouchers.length > 0 },
    { value: "cheques", label: "Cheques", icon: CreditCard, count: cheques.length, show: cheques.length > 0 },
    { value: "stocks", label: "Stocks", icon: Package, count: stocks.length, show: stocks.length > 0 },
    { value: "stays", label: "Stays", icon: Hotel, count: reservations.length, show: reservations.length > 0 },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
        {/* Header */}
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back" className="-ml-2 shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                {customer.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(customer.photo_url, CONTENT_BASE_URL)} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary" aria-hidden="true">
                    {initials(String(customer.name || ""))}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-bold tracking-tight">{customer.name}</h1>
                    <Badge variant="outline" className={segment.tone}>{segment.label}</Badge>
                    {member?.tier_name && (
                      <Badge variant="outline" className="gap-1" style={{ borderColor: member.tier_color, color: member.tier_color }}>
                        <Award className="h-3 w-3" aria-hidden="true" /> {member.tier_name}
                      </Badge>
                    )}
                    {!num(customer.is_active) && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-mono">{custNo}</span>
                    {customer.order_type && <> · {customer.order_type}</>}
                    {customer.created_at && <> · Customer since {date(customer.created_at)}</>}
                    {lastVisit != null && <> · Last purchase {lastVisit === 0 ? "today" : `${lastVisit} days ago`}</>}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customer.phone && (
                      <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                        <a href={`tel:${customer.phone}`}><Phone className="h-3.5 w-3.5" aria-hidden="true" /> {customer.phone}</a>
                      </Button>
                    )}
                    {waNumber.length >= 9 && (
                      <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                        <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp</a>
                      </Button>
                    )}
                    {validEmail && (
                      <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                        <a href={`mailto:${customer.email}`}><Mail className="h-3.5 w-3.5" aria-hidden="true" /> {customer.email}</a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button asChild variant="outline" className="gap-2">
                  <Link href={`/cms/customers/form?id=${customer.id}`}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/sales/quotations/create"><FileText className="h-4 w-4" aria-hidden="true" /> New quotation</Link>
                </Button>
                <Button asChild className="gap-2">
                  <Link href="/cms/invoices/create"><Plus className="h-4 w-4" aria-hidden="true" /> New invoice</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {overdue > 0 && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <p><span className="font-semibold text-rose-700 dark:text-rose-300">{money(overdue)} overdue</span>
              <span className="text-muted-foreground"> across {num(stats.overdue_invoices)} invoice{num(stats.overdue_invoices) === 1 ? "" : "s"} past the due date.</span></p>
          </div>
        )}
        {creditUse != null && creditUse >= 80 && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p><span className="font-semibold text-amber-700 dark:text-amber-300">{creditUse.toFixed(0)}% of the credit limit used</span>
              <span className="text-muted-foreground"> ({money(outstanding)} of {money(creditLimit)}).</span></p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Kpi label="Lifetime value" icon={TrendingUp} value={money(stats.total_spent)} sub={`${num(stats.total_invoices)} invoices`} />
          <Kpi label="Outstanding" icon={Wallet} value={money(outstanding)} tone={outstanding > 0 ? "text-rose-600" : "text-emerald-600"}
            sub={overdue > 0 ? `${money(overdue)} overdue` : outstanding > 0 ? "None overdue" : "All settled"} />
          <Kpi label="Average invoice" icon={Receipt} value={money(stats.avg_invoice)} sub={`${paidRatio.toFixed(0)}% paid overall`} />
          <Kpi label="Last 90 days" icon={Clock} value={money(stats.spent_90d)} trend={trend} sub="vs previous 90 days" />
          {member ? (
            <Kpi label="Loyalty points" icon={Award} value={`${num(member.points_balance).toLocaleString()} pts`} tone="text-emerald-600"
              sub={`${num(member.lifetime_points).toLocaleString()} earned in total`} />
          ) : (
            <Kpi label="First purchase" icon={Calendar} value={date(stats.first_purchase)} sub={stats.last_purchase ? `Last: ${date(stats.last_purchase)}` : "No purchases yet"} />
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Left: chart + activity */}
          <div className="space-y-5 xl:col-span-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Spending, last 12 months</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px] pl-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} className="fill-muted-foreground" />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={moneyShort} className="fill-muted-foreground" />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))" }} formatter={(v: number) => [money(v), "Spent"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? <Empty text="No activity yet." /> : (
                  <ol className="relative space-y-1">
                    {activity.map((a, i) => {
                      const row = (
                        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.tone}`}><a.icon className="h-4 w-4" aria-hidden="true" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{a.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{date(a.at)}{a.detail ? ` · ${a.detail}` : ""}</p>
                          </div>
                          {a.amount != null && (
                            <span className={`text-sm font-semibold tabular-nums ${a.amount < 0 ? "text-rose-600" : a.kind === "Payment" ? "text-emerald-600" : ""}`}>
                              {a.kind === "Payment" ? "+ " : ""}{money(Math.abs(a.amount))}
                            </span>
                          )}
                          {a.href && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                        </div>
                      );
                      return <li key={i}>{a.href ? <Link href={a.href}>{row}</Link> : row}</li>;
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: details, loyalty, insights */}
          <div className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { icon: MapPin, label: "Address", value: customer.address },
                  { icon: Mail, label: "Email", value: customer.email },
                  { icon: Calendar, label: "Date of birth", value: customer.dob ? date(customer.dob) : null },
                ].map(r => (
                  <div key={r.label} className="flex items-start gap-3">
                    <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0"><p className="text-xs text-muted-foreground">{r.label}</p><p className="break-words font-medium">{r.value || "—"}</p></div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div><p className="text-xs text-muted-foreground">NIC</p><p className="font-mono font-medium">{customer.nic || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Tax number</p><p className="font-mono font-medium">{customer.tax_number || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Credit limit</p><p className="font-medium">{creditLimit > 0 ? money(creditLimit) : "None"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Credit days</p><p className="font-medium">{num(customer.credit_days) || "—"}</p></div>
                </div>
                {creditUse != null && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Credit used</span><span>{creditUse.toFixed(0)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${creditUse >= 80 ? "bg-rose-500" : creditUse >= 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${creditUse}%` }} />
                    </div>
                  </div>
                )}
                {customer.qr_code_hash && (
                  <div className="flex items-center gap-4 border-t pt-3">
                    <div className="rounded-md bg-white p-2"><QRCodeSVG id="customer-qr-code" value={customer.qr_code_hash} size={72} level="H" /></div>
                    <Button variant="outline" size="sm" className="gap-2" onClick={printIdCard}><Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print ID card</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {member && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>Loyalty</span>
                    {member.member_no && <span className="font-mono text-xs font-normal text-muted-foreground">{member.member_no}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-emerald-600 tabular-nums">{num(member.points_balance).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">points available</span>
                  </div>
                  {nextTier && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>To {nextTier.name}</span>
                        <span>{Math.max(0, num(nextTier.threshold) - num(member.lifetime_points)).toLocaleString()} more</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (num(member.lifetime_points) / Math.max(1, num(nextTier.threshold))) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {num(member.discount_pct) > 0 && <p className="text-xs text-muted-foreground">Tier discount: {num(member.discount_pct)}%</p>}
                  {(loyalty.ledger || []).slice(0, 5).map((l: any, i: number) => (
                    <div key={i} className="flex justify-between border-t pt-2 text-xs">
                      <span className="text-muted-foreground">{date(l.created_at)} · {l.note || l.type}</span>
                      <span className={`font-semibold ${num(l.points) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{num(l.points) > 0 ? "+" : ""}{num(l.points)}</span>
                    </div>
                  ))}
                  <Button asChild variant="ghost" size="sm" className="w-full"><Link href="/loyalty/members">Open loyalty members</Link></Button>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {items.length === 0 ? <Empty text="No purchases yet." /> : items.slice(0, 5).map((it, i) => {
                  const max = num(items[0].total_spent) || 1;
                  return (
                    <div key={i}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{it.item_name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{money(it.total_spent)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(num(it.total_spent) / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {methods.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">How they pay</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {methods.map((m, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{m.payment_method || "Other"} <span className="text-xs text-muted-foreground">× {num(m.n)}</span></span>
                      <span className="tabular-nums text-muted-foreground">{money(m.total)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Records */}
        <Card className="shadow-sm">
          <CardContent className="p-4 md:p-5">
            <Tabs defaultValue="invoices" className="space-y-4">
              <div className="overflow-x-auto">
                <TabsList className="h-auto w-max">
                  {tabs.filter(t => t.show).map(t => (
                    <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                      <t.icon className="h-3.5 w-3.5" aria-hidden="true" /> {t.label}
                      <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{t.count}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="invoices">
                {invoices.length === 0 ? <Empty text="No invoices yet." /> : (
                  <Table head={["Invoice", "Date", "Due", "Total", "Paid", "Balance", "Status", ""]}>
                    {invoices.map(inv => {
                      const bal = num(inv.grand_total) - num(inv.paid_amount);
                      const late = bal > 0 && inv.due_date && daysSince(inv.due_date)! > 0 && inv.status !== "Cancelled";
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30">
                          <td className={`${td} font-mono font-medium`}>{inv.invoice_no}</td>
                          <td className={td}>{date(inv.issue_date)}</td>
                          <td className={`${td} ${late ? "font-medium text-rose-600" : ""}`}>{date(inv.due_date)}</td>
                          <td className={`${td} tabular-nums`}>{money(inv.grand_total)}</td>
                          <td className={`${td} tabular-nums`}>{money(inv.paid_amount)}</td>
                          <td className={`${td} tabular-nums font-medium ${bal > 0 ? "text-rose-600" : ""}`}>{money(Math.max(0, bal))}</td>
                          <td className={td}><StatusBadge status={late ? "Overdue" : inv.status} /></td>
                          <td className={`${td} text-right`}>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/cms/invoices/${inv.id}/view`} aria-label={`Open invoice ${inv.invoice_no}`}><ExternalLink className="h-4 w-4" /></Link></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="payments">
                {payments.length === 0 ? <Empty text="No payments yet." /> : (
                  <Table head={["Receipt", "Date", "Method", "For invoice", "Amount", "Status"]}>
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className={`${td} font-mono font-medium`}>{p.receipt_no}</td>
                        <td className={td}>{date(p.payment_date)}</td>
                        <td className={td}>{p.payment_method || "—"}</td>
                        <td className={`${td} font-mono`}>{p.invoice_no || "—"}</td>
                        <td className={`${td} tabular-nums font-medium text-emerald-600`}>{money(p.amount)}</td>
                        <td className={td}><StatusBadge status={p.status || "Paid"} /></td>
                      </tr>
                    ))}
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="items" className="space-y-3">
                {items.length > 0 && (
                  <div className="relative max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input value={itemQuery} onChange={e => setItemQuery(e.target.value)} placeholder="Search items" aria-label="Search items" className="h-9 pl-8" />
                  </div>
                )}
                {filteredItems.length === 0 ? <Empty text={items.length ? "No items match." : "No purchases yet."} /> : (
                  <Table head={["Item", "Times bought", "Qty", "Avg price", "Total spent", "Last bought"]}>
                    {filteredItems.map((it, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className={`${td} font-medium`}>{it.item_name}</td>
                        <td className={`${td} tabular-nums`}>{num(it.times) || "—"}</td>
                        <td className={`${td} tabular-nums`}>{num(it.total_qty).toLocaleString()}</td>
                        <td className={`${td} tabular-nums`}>{money(it.avg_price)}</td>
                        <td className={`${td} tabular-nums font-medium`}>{money(it.total_spent)}</td>
                        <td className={td}>{date(it.last_purchased)}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="orders">
                <Table head={["Order", "Vehicle", "Problem", "Technician", "Status", "Opened", ""]}>
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className={`${td} font-mono font-medium`}>#{o.id}</td>
                      <td className={td}>{[o.vehicle_identifier, o.vehicle_model].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="max-w-[280px] truncate px-3 py-2.5">{o.problem_description || "—"}</td>
                      <td className={td}>{o.technician || "—"}</td>
                      <td className={td}><StatusBadge status={o.status} /></td>
                      <td className={td}>{date(o.created_at)}</td>
                      <td className={`${td} text-right`}><Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/orders/${o.id}`} aria-label={`Open order ${o.id}`}><ExternalLink className="h-4 w-4" /></Link></Button></td>
                    </tr>
                  ))}
                </Table>
              </TabsContent>

              <TabsContent value="vehicles">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {vehicles.map(v => (
                    <div key={v.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><Car className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"} {v.year ? `(${v.year})` : ""}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{v.vin || `#${v.id}`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="quotations">
                <Table head={["Quotation", "Date", "Expires", "Total", "Status", ""]}>
                  {quotations.map(q => (
                    <tr key={q.id} className="hover:bg-muted/30">
                      <td className={`${td} font-mono font-medium`}>{q.quotation_no}</td>
                      <td className={td}>{date(q.issue_date)}</td>
                      <td className={td}>{date(q.expiry_date)}</td>
                      <td className={`${td} tabular-nums`}>{money(q.grand_total)}</td>
                      <td className={td}><StatusBadge status={q.converted_invoice_id ? "Converted" : q.status} /></td>
                      <td className={`${td} text-right`}><Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/sales/quotations/${q.id}`} aria-label={`Open quotation ${q.quotation_no}`}><ExternalLink className="h-4 w-4" /></Link></Button></td>
                    </tr>
                  ))}
                </Table>
              </TabsContent>

              <TabsContent value="returns">
                <Table head={["Document", "Date", "Reason", "Amount", "Status"]}>
                  {returns.map(r => (
                    <tr key={`r${r.id}`} className="hover:bg-muted/30">
                      <td className={`${td} font-mono font-medium`}>{r.return_no} <span className="text-xs text-muted-foreground">(return)</span></td>
                      <td className={td}>{date(r.return_date)}</td>
                      <td className={td}>{r.reason || "—"}</td>
                      <td className={`${td} tabular-nums text-rose-600`}>{money(r.total_amount)}</td>
                      <td className={td}><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                  {creditNotes.map(c => (
                    <tr key={`c${c.id}`} className="hover:bg-muted/30">
                      <td className={`${td} font-mono font-medium`}>{c.cn_no} <span className="text-xs text-muted-foreground">(credit note)</span></td>
                      <td className={td}>{date(c.cn_date)}</td>
                      <td className={td}>{c.reason || "—"}</td>
                      <td className={`${td} tabular-nums text-rose-600`}>{money(c.total)}</td>
                      <td className={td}><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </Table>
              </TabsContent>

              <TabsContent value="vouchers">
                <Table head={["Code", "Value", "Balance", "Expires", "Status"]}>
                  {vouchers.map(v => (
                    <tr key={v.id} className="hover:bg-muted/30">
                      <td className={`${td} font-mono font-medium`}>{v.code}</td>
                      <td className={`${td} tabular-nums`}>{money(v.initial_value)}</td>
                      <td className={`${td} tabular-nums font-medium`}>{money(v.balance)}</td>
                      <td className={td}>{date(v.expires_at)}</td>
                      <td className={td}><StatusBadge status={v.status} /></td>
                    </tr>
                  ))}
                </Table>
              </TabsContent>

              <TabsContent value="cheques">
                <Table head={["Cheque", "Bank", "Cheque date", "Amount", "Status"]}>
                  {cheques.map(c => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className={`${td} font-mono font-medium`}>#{c.cheque_no_last6}</td>
                      <td className={td}>{c.bank_name || "—"}</td>
                      <td className={td}>{date(c.cheque_date)}</td>
                      <td className={`${td} tabular-nums`}>{money(c.amount)}</td>
                      <td className={td}><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </Table>
              </TabsContent>

              <TabsContent value="stocks">
                <Table head={["Item", "Batch", "Invoice", "Original", "Sold", "Remaining", "Expiry", ""]}>
                  {stocks.map(s => {
                    const orig = num(s.quantity), sold = num(s.sold_qty), rem = orig - sold;
                    return (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className={`${td} font-medium`}>{s.item_description}</td>
                        <td className={`${td} font-mono text-xs`}>{s.batch_number || "—"}</td>
                        <td className={`${td} font-mono text-xs`}>{s.invoice_no || "—"}</td>
                        <td className={`${td} tabular-nums`}>{orig.toLocaleString()}</td>
                        <td className={`${td} tabular-nums`}>{sold.toLocaleString()}</td>
                        <td className={`${td} tabular-nums font-medium ${rem > 0 ? "" : "text-rose-600"}`}>{rem.toLocaleString()}</td>
                        <td className={td}>{s.expire_date ? date(s.expire_date) : "—"}</td>
                        <td className={`${td} text-right`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Update sold quantity" onClick={() => {
                            setStockUpdateModal({ isOpen: true, stockId: s.id, currentSoldQty: sold, maxQty: orig });
                            setStockUpdateQty(String(sold));
                          }}><Edit2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              </TabsContent>

              <TabsContent value="stays">
                <Table head={["Room", "Check-in", "Check-out", "Total", "Status", ""]}>
                  {reservations.map(r => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className={`${td} font-medium`}>{r.room_no || "TBD"}</td>
                      <td className={td}>{date(r.check_in)}</td>
                      <td className={td}>{date(r.check_out)}</td>
                      <td className={`${td} tabular-nums`}>{r.total_amount != null ? money(r.total_amount) : "—"}</td>
                      <td className={td}><StatusBadge status={r.status} /></td>
                      <td className={`${td} text-right`}><Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/front-office/reservations/${r.id}`} aria-label="Open reservation"><ExternalLink className="h-4 w-4" /></Link></Button></td>
                    </tr>
                  ))}
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={stockUpdateModal.isOpen} onOpenChange={open => setStockUpdateModal({ ...stockUpdateModal, isOpen: open })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update sold quantity</DialogTitle>
            <DialogDescription>Enter the total quantity sold from this batch (0 to {stockUpdateModal.maxQty}).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="sold_qty">Sold quantity</Label>
            <Input id="sold_qty" type="number" min="0" max={stockUpdateModal.maxQty} step="0.01" value={stockUpdateQty} onChange={e => setStockUpdateQty(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockUpdateModal({ ...stockUpdateModal, isOpen: false })}>Cancel</Button>
            <Button onClick={handleUpdateStockConfirm}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
