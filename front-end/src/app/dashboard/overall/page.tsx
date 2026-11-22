"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  DollarSign, TrendingUp, Package, MessageSquare, Wrench, Building2, CalendarDays, ShoppingCart,
  Users, RefreshCcw, ChevronRight, FileText, BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, SectionCard, EmptyState, LoadingState } from "@/components/page-shell";
import { SERIES, axisTick, compact, gridStroke, lkr, tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from "@/components/dashboard/chart-theme";
import { moduleAllowed, useSaasModules } from "@/lib/dashboards";
import {
  fetchDashboardOverview, fetchSalesDashboard, fetchEmployees, fetchInquiries, fetchCustomers, fetchParts,
  fetchHotelReservations, fetchBanquetBookings, fetchOnlineOrders,
  type DashboardOverview, type SalesDashboardData,
} from "@/lib/api";

type Ops = {
  workshop: DashboardOverview | null;
  sales: SalesDashboardData | null;
  staff: number | null;
  inquiries: number | null;
  customers: number | null;
  lowStock: number | null;
  guests: number | null;
  banquets: number | null;
  onlineOrders: number | null;
};

const listOf = (x: any) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);

export default function OverallDashboardPage() {
  const modules = useSaasModules();
  const has = useCallback((m: string) => moduleAllowed(modules, m), [modules]);

  const [ops, setOps] = useState<Ops | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!modules) return;
    setLoading(true);
    // Only ask for what this company is licensed to use.
    const skip = Promise.resolve(null);
    const [workshop, sales, staff, inq, cust, parts, hotel, banquets, online] = await Promise.all([
      has("fleet") ? fetchDashboardOverview().catch(() => null) : skip,
      fetchSalesDashboard().catch(() => null),
      has("hrm") ? fetchEmployees().catch(() => null) : skip,
      has("crm") ? fetchInquiries({ status: "New" }).catch(() => null) : skip,
      fetchCustomers().catch(() => null),
      has("inventory") ? fetchParts().catch(() => null) : skip,
      has("frontOffice") ? fetchHotelReservations().catch(() => null) : skip,
      has("banquet") ? fetchBanquetBookings().catch(() => null) : skip,
      has("ecommerce") ? fetchOnlineOrders().catch(() => null) : skip,
    ]);
    setOps({
      workshop: workshop as DashboardOverview | null,
      sales: sales as SalesDashboardData | null,
      staff: staff ? listOf(staff).filter((e: any) => e.status === "Active").length : null,
      inquiries: inq ? listOf(inq).length : null,
      customers: cust ? listOf(cust).length : null,
      lowStock: parts ? listOf(parts).filter((p: any) => p.item_type === "Part" && Number(p.stock_quantity) <= Number(p.reorder_level || 0)).length : null,
      guests: hotel ? listOf(hotel).filter((r: any) => r.status === "CheckedIn").length : null,
      banquets: banquets ? listOf(banquets).filter((b: any) => b.status === "Confirmed").length : null,
      onlineOrders: online ? listOf(online).filter((o: any) => o.order_status === "Pending").length : null,
    });
    setUpdatedAt(new Date());
    setLoading(false);
  }, [modules, has]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(t);
  }, [load]);

  const s = ops?.sales;
  const trend = useMemo(
    () => (s?.revenueTrend || []).map((r: any) => ({ date: format(new Date(r.date), "MMM d"), revenue: Number(r.amount ?? r.revenue ?? 0) })),
    [s]
  );

  const kpis = [
    { label: "Revenue today", value: lkr(s?.kpis?.today?.revenue || 0), hint: `${s?.kpis?.today?.count || 0} invoices`, icon: <DollarSign /> },
    { label: "Revenue this month", value: lkr(s?.kpis?.month?.revenue || 0), hint: `Avg ticket ${lkr(s?.kpis?.avgOrderValue || 0)}`, icon: <TrendingUp /> },
    ops?.lowStock != null && { label: "Low stock items", value: ops.lowStock, hint: ops.lowStock ? "At or below reorder level" : "Stock levels fine", icon: <Package /> },
    ops?.inquiries != null && { label: "New inquiries", value: ops.inquiries, hint: ops.inquiries ? "Waiting for a reply" : "All answered", icon: <MessageSquare /> },
    ops?.customers != null && { label: "Customers", value: ops.customers.toLocaleString(), icon: <Users /> },
  ].filter(Boolean) as { label: string; value: React.ReactNode; hint?: string; icon: React.ReactNode }[];

  const moduleTiles = [
    ops?.workshop && { label: "Workshop", value: `${ops.workshop.ordersByStatus?.["In Progress"] || 0} jobs in progress`, hint: `${ops.workshop.ordersByStatus?.["Pending"] || 0} pending`, href: "/dashboard", icon: Wrench },
    ops?.guests != null && { label: "Front office", value: `${ops.guests} guests in house`, hint: "Checked-in reservations", href: "/front-office/dashboard", icon: Building2 },
    ops?.banquets != null && { label: "Banquet", value: `${ops.banquets} confirmed events`, hint: "Upcoming bookings", href: "/banquet/dashboard", icon: CalendarDays },
    ops?.onlineOrders != null && { label: "E-commerce", value: `${ops.onlineOrders} pending orders`, hint: "Online orders to fulfil", href: "/ecommerce/orders", icon: ShoppingCart },
    ops?.staff != null && { label: "Team", value: `${ops.staff} active staff`, hint: "Employees on record", href: "/hrm/employees", icon: Users },
  ].filter(Boolean) as { label: string; value: string; hint: string; href: string; icon: any }[];

  const recent = (s?.recentSales || []).slice(0, 6);

  return (
    <DashboardLayout title="Business Overview">
      <div className="space-y-5">
        <PageHeader
          title="Business Overview"
          description={updatedAt ? `Updated ${format(updatedAt, "HH:mm")} · refreshes every minute` : "Loading the latest numbers…"}
          actions={<>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button variant="outline" asChild><Link href="/reports"><BarChart3 className="h-4 w-4 mr-2" aria-hidden="true" /> Reports</Link></Button>
          </>}
        />

        {!ops ? <Card><LoadingState /></Card> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {kpis.map((k) => <StatCard key={k.label} label={k.label} value={k.value} hint={k.hint} icon={k.icon} />)}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <SectionCard
                className="lg:col-span-2"
                title="Revenue"
                description="Daily invoiced revenue, last 30 days"
                action={<Button variant="ghost" size="sm" asChild><Link href="/dashboard/sales">Sales dashboard <ChevronRight className="h-4 w-4" /></Link></Button>}
                bodyClassName="h-[280px] p-3"
              >
                {trend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ovRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={gridStroke} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisTick} minTickGap={24} />
                      <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={compact} width={44} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                        formatter={(v) => [lkr(Number(v)), "Revenue"]} cursor={{ stroke: gridStroke }} />
                      <Area type="monotone" dataKey="revenue" stroke={SERIES[0]} strokeWidth={2} fill="url(#ovRevenue)" activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="No sales yet" description="Revenue appears here once invoices are issued." />}
              </SectionCard>

              <SectionCard title="Recent invoices" description="Latest sales across locations"
                action={<Button variant="ghost" size="sm" asChild><Link href="/cms/invoices">All <ChevronRight className="h-4 w-4" /></Link></Button>}>
                {recent.length ? (
                  <ul className="divide-y">
                    {recent.map((r: any) => (
                      <li key={r.id}>
                        <Link href={`/cms/invoices/${r.id}/view`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{r.customer_name || "Walk-in"}</span>
                            <span className="block text-xs text-muted-foreground tabular-nums">{r.invoice_no} · {format(new Date(r.date), "MMM d")}</span>
                          </span>
                          <span className="text-sm tabular-nums font-medium">{lkr(r.total)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="No invoices yet" />}
              </SectionCard>
            </div>

            {moduleTiles.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {moduleTiles.map((t) => (
                  <Link key={t.label} href={t.href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Card className="flex h-full items-center gap-3 p-4 transition-colors group-hover:bg-muted/40">
                      <div className="rounded-md bg-muted p-2 text-muted-foreground"><t.icon className="h-4 w-4" aria-hidden="true" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{t.label}</p>
                        <p className="font-medium">{t.value}</p>
                        <p className="text-xs text-muted-foreground">{t.hint}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {!recent.length && !trend.length && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" aria-hidden="true" /> Tip: choose which dashboard opens after login in Company Profile → Home dashboard.
              </p>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
