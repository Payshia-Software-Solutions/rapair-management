"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, CheckCircle2, ChevronRight, ClipboardList, Clock, LayoutGrid, Plus, RefreshCcw, Wrench } from "lucide-react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, SectionCard, EmptyState, LoadingState } from "@/components/page-shell";
import { ChartLegend } from "@/components/dashboard/chart-legend";
import { SERIES, axisTick, gridStroke, tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from "@/components/dashboard/chart-theme";
import { fetchDashboardOverview, type DashboardOverview } from "@/lib/api";

function parseMysql(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function timeAgo(value: string) {
  const d = parseMysql(value);
  if (!d) return value;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

const niceDateTime = (v: string | null) => { const d = parseMysql(v || ""); return d ? format(d, "MMM d, HH:mm") : "—"; };

export default function WorkshopDashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDashboardOverview());
      setUpdatedAt(new Date());
    } catch (e) {
      setError((e as Error).message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(t);
  }, []);

  const byStatus = data?.ordersByStatus ?? {};
  const throughput = useMemo(
    () => (data?.throughputLast7Days ?? []).map((r) => ({ name: r.date.slice(5), Received: r.received, Completed: r.completed })),
    [data]
  );

  const bays = data?.serviceBaysByStatus ?? {};
  const bayRows = [
    { label: "Occupied", value: bays["Occupied"] ?? 0, color: SERIES[0] },
    { label: "Available", value: bays["Available"] ?? 0, color: SERIES[2] },
    { label: "Out of service", value: bays["Out of Service"] ?? 0, color: SERIES[1] },
  ];
  const bayPie = bayRows.filter((b) => b.value > 0);

  const urgent = data?.urgentAttention ?? [];
  const recent = data?.recentCompletions ?? [];

  return (
    <DashboardLayout title="Workshop Dashboard">
      <div className="space-y-5">
        <PageHeader
          title="Workshop Dashboard"
          description={updatedAt ? `Repair orders and bays · updated ${format(updatedAt, "HH:mm:ss")}` : "Repair orders and bays"}
          actions={<>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button variant="outline" asChild><Link href="/dashboard/bays"><LayoutGrid className="h-4 w-4 mr-2" aria-hidden="true" /> Bays board</Link></Button>
            <Button asChild><Link href="/orders/new"><Plus className="h-4 w-4 mr-2" aria-hidden="true" /> New order</Link></Button>
          </>}
        />

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <span><span className="font-medium">Dashboard unavailable.</span> <span className="text-muted-foreground">{error}</span></span>
          </div>
        )}

        {!data && loading ? <Card><LoadingState /></Card> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Pending orders" value={byStatus["Pending"] ?? 0} hint="Waiting for assignment" icon={<ClipboardList />} />
              <StatCard label="In progress" value={byStatus["In Progress"] ?? 0} hint="Being worked on" icon={<Wrench />} />
              <StatCard label="Completed today" value={data?.completedToday ?? 0} hint="Finished jobs" icon={<CheckCircle2 />} />
              <StatCard label="Avg. repair time" value={data?.avgRepairHours ? `${data.avgRepairHours}h` : "—"} hint="Completed, last 30 days" icon={<Clock />} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <SectionCard className="lg:col-span-2" title="Throughput" description="Orders received vs completed, last 7 days">
                <div className="h-[260px] p-3">
                  {throughput.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={throughput} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={gridStroke} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
                        <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={axisTick} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ stroke: gridStroke }} />
                        <Area type="monotone" dataKey="Received" stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.08} activeDot={{ r: 4 }} />
                        <Area type="monotone" dataKey="Completed" stroke={SERIES[1]} strokeWidth={2} fill={SERIES[1]} fillOpacity={0.08} activeDot={{ r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <EmptyState title="No orders in the last 7 days" />}
                </div>
                <div className="flex gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[0] }} /> Received</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[1] }} /> Completed</span>
                </div>
              </SectionCard>

              <SectionCard title="Service bays" description={`${data?.serviceBaysTotal ?? 0} bays in total`}
                action={<Button variant="ghost" size="sm" asChild><Link href="/dashboard/bays">Board <ChevronRight className="h-4 w-4" /></Link></Button>}
                bodyClassName="grid grid-cols-2 items-center gap-4 p-4">
                <div className="h-[140px]">
                  {bayPie.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={bayPie} dataKey="value" nameKey="label" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                          {bayPie.map((b) => <Cell key={b.label} fill={b.color} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground">No bays set up.</p>}
                </div>
                <ChartLegend items={bayRows.map((b) => ({ label: b.label, color: b.color, value: b.value }))} />
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <SectionCard title="Needs attention" description="Urgent and emergency orders">
                {urgent.length === 0 ? <EmptyState title="Nothing urgent" description="No high-priority orders right now." /> : (
                  <ul className="divide-y">
                    {urgent.map((u) => (
                      <li key={u.id}>
                        <Link href={`/orders/${u.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{u.vehicle_model || `Order #${u.id}`}</span>
                            <span className="block text-xs text-muted-foreground">{u.expected_time ? `Due ${niceDateTime(u.expected_time)}` : `Created ${niceDateTime(u.created_at)}`}</span>
                          </span>
                          <Badge variant="destructive" className="font-normal">{u.priority || "Urgent"}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Recently completed" description="Latest finished repair orders">
                {recent.length === 0 ? <EmptyState title="No completed orders yet" /> : (
                  <ul className="divide-y">
                    {recent.map((r) => (
                      <li key={r.id}>
                        <Link href={`/orders/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{r.vehicle_model || `Order #${r.id}`}</span>
                            <span className="block text-xs text-muted-foreground">Completed {timeAgo(r.completed_at)}</span>
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">#{r.id}</span>
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
