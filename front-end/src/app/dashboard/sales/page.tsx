"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, ChevronRight, CreditCard, DollarSign, FileText, RefreshCcw, TrendingUp, Wallet } from "lucide-react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, SectionCard, EmptyState, LoadingState } from "@/components/page-shell";
import { ChartLegend } from "@/components/dashboard/chart-legend";
import { SERIES, axisTick, compact, gridStroke, lkr, tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from "@/components/dashboard/chart-theme";
import { fetchSalesDashboard, type SalesDashboardData } from "@/lib/api";

const statusVariant = (s: string) => (s === "Paid" ? "secondary" : s === "Cancelled" ? "destructive" : "outline") as "secondary" | "destructive" | "outline";

export default function SalesDashboardPage() {
  const [data, setData] = useState<SalesDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSalesDashboard());
    } catch (e) {
      setError((e as Error).message || "Failed to load sales dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const trend = useMemo(
    () => (data?.revenueTrend || []).map((r: any) => ({ name: format(new Date(r.date), "MMM d"), revenue: Number(r.revenue ?? r.amount ?? 0) })),
    [data]
  );

  // Fixed colour per method in the order the API returns them; folded to 6 + "Other".
  const methods = useMemo(() => {
    const rows = (data?.paymentMethods || []).filter((p) => p.amount > 0).sort((a, b) => b.amount - a.amount);
    const top = rows.slice(0, 5).map((p, i) => ({ label: p.method, value: p.amount, color: SERIES[i] }));
    const rest = rows.slice(5).reduce((s, p) => s + p.amount, 0);
    return rest > 0 ? [...top, { label: "Other", value: rest, color: SERIES[5] }] : top;
  }, [data]);
  const methodTotal = methods.reduce((s, m) => s + m.value, 0);

  const k = data?.kpis;
  const topItems = data?.topItems || [];
  const maxItem = topItems[0]?.revenue || 1;

  return (
    <DashboardLayout title="Sales Dashboard">
      <div className="space-y-5">
        <PageHeader
          title="Sales Dashboard"
          description="Revenue, collections and what's selling."
          actions={<>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button asChild><Link href="/cms/invoices/new"><FileText className="h-4 w-4 mr-2" aria-hidden="true" /> New invoice</Link></Button>
          </>}
        />

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> {error}
          </div>
        )}

        {!data && loading ? <Card><LoadingState /></Card> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Revenue today" value={lkr(k?.today?.revenue || 0)} hint={`${k?.today?.count || 0} invoices`} icon={<DollarSign />} />
              <StatCard label="Revenue this month" value={lkr(k?.month?.revenue || 0)} hint="Month to date" icon={<TrendingUp />} />
              <StatCard label="Collected today" value={lkr(k?.today?.collection || 0)} hint="Payments received" icon={<CreditCard />} />
              <StatCard label="Collected this month" value={lkr(k?.month?.collection || 0)} hint="Month to date" icon={<Wallet />} />
              <StatCard label="Outstanding" value={lkr(k?.outstanding || 0)} hint="Unpaid balance" icon={<AlertCircle />} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <SectionCard className="lg:col-span-2" title="Revenue" description="Daily invoiced revenue, last 30 days" bodyClassName="h-[300px] p-3">
                {trend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={gridStroke} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} minTickGap={24} />
                      <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={compact} width={44} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                        formatter={(v) => [lkr(Number(v)), "Revenue"]} cursor={{ stroke: gridStroke }} />
                      <Area type="monotone" dataKey="revenue" stroke={SERIES[0]} strokeWidth={2} fill="url(#salesRevenue)" activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="No sales in the last 30 days" />}
              </SectionCard>

              <SectionCard title="Payment methods" description="Share of collections" bodyClassName="space-y-4 p-4">
                {methods.length ? (
                  <>
                    <div className="h-[170px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={methods} dataKey="value" nameKey="label" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                            {methods.map((m) => <Cell key={m.label} fill={m.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} formatter={(v) => lkr(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ChartLegend items={methods.map((m) => ({ label: m.label, color: m.color, value: `${Math.round((m.value / methodTotal) * 100)}%` }))} />
                  </>
                ) : <EmptyState title="No payments yet" />}
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <SectionCard title="Top items" description="Best sellers this month by revenue">
                {topItems.length === 0 ? <EmptyState title="No data for this period" /> : (
                  <ul className="divide-y">
                    {topItems.map((item, i) => (
                      <li key={i} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{item.name}</span>
                            <span className="block text-xs text-muted-foreground tabular-nums">{item.qty} sold</span>
                          </span>
                          <span className="text-sm tabular-nums font-medium">{lkr(item.revenue)}</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${(item.revenue / maxItem) * 100}%`, background: SERIES[0] }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Recent invoices" description="Latest across all locations"
                action={<Button variant="ghost" size="sm" asChild><Link href="/cms/invoices">All <ChevronRight className="h-4 w-4" /></Link></Button>}>
                {(data?.recentSales || []).length === 0 ? <EmptyState title="No recent invoices" /> : (
                  <ul className="divide-y">
                    {(data?.recentSales || []).map((sale) => (
                      <li key={sale.id}>
                        <Link href={`/cms/invoices/${sale.id}/view`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{sale.customer_name || "Walk-in"}</span>
                            <span className="block text-xs text-muted-foreground tabular-nums">{sale.invoice_no} · {format(new Date(sale.date), "MMM d, yyyy")}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge variant={statusVariant(sale.status)} className="font-normal">{sale.status}</Badge>
                            <span className="w-28 text-right text-sm tabular-nums font-medium">{lkr(sale.total)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
