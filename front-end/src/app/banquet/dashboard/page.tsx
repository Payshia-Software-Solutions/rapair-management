"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, ChevronRight, ClipboardList, LayoutGrid, Plus, RefreshCcw, Wallet } from "lucide-react";
import { addMonths, format, startOfMonth } from "date-fns";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, SectionCard, EmptyState, LoadingState } from "@/components/page-shell";
import { SERIES, axisTick, compact, gridStroke, lkr, tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from "@/components/dashboard/chart-theme";
import { api } from "@/lib/api";

type Booking = {
  id: number; booking_no: string; booking_date: string; session?: string; status: string;
  total_amount: number | string; advance_paid?: number | string; pax_count?: number;
  customer_name?: string; hall_name?: string;
};

const ACTIVE = (s: string) => s !== "Cancelled";

export default function BanquetDashboard() {
  const [halls, setHalls] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, b] = await Promise.all([
        api("/api/banquet/halls").then((r) => r.json()).catch(() => null),
        api("/api/banquet/bookings").then((r) => r.json()).catch(() => null),
      ]);
      setHalls(Array.isArray(h?.data) ? h.data.length : 0);
      setBookings(Array.isArray(b?.data) ? b.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const today = new Date(new Date().toDateString());
  const in30 = new Date(today.getTime() + 30 * 86400000);
  const list = bookings || [];
  const upcoming = list
    .filter((b) => ACTIVE(b.status) && new Date(b.booking_date) >= today)
    .sort((a, b) => +new Date(a.booking_date) - +new Date(b.booking_date));
  const next30 = upcoming.filter((b) => new Date(b.booking_date) <= in30);
  const confirmed = list.filter((b) => b.status === "Confirmed").length;
  const thisMonth = startOfMonth(today);
  const monthValue = list
    .filter((b) => ACTIVE(b.status) && startOfMonth(new Date(b.booking_date)).getTime() === thisMonth.getTime())
    .reduce((s, b) => s + Number(b.total_amount || 0), 0);

  // Booked value per month: this month and the next five.
  const byMonth = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(thisMonth, i)));
    return months.map((m) => ({
      month: format(m, "MMM"),
      value: list
        .filter((b) => ACTIVE(b.status) && startOfMonth(new Date(b.booking_date)).getTime() === m.getTime())
        .reduce((s, b) => s + Number(b.total_amount || 0), 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  return (
    <DashboardLayout title="Banquet Dashboard">
      <div className="space-y-5">
        <PageHeader
          title="Banquet Dashboard"
          description="Events, venues and booked value."
          actions={<>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
            <Button variant="outline" asChild><Link href="/banquet/calendar"><CalendarDays className="h-4 w-4 mr-2" aria-hidden="true" /> Calendar</Link></Button>
            <Button asChild><Link href="/banquet/bookings/new"><Plus className="h-4 w-4 mr-2" aria-hidden="true" /> New booking</Link></Button>
          </>}
        />

        {!bookings ? <Card><LoadingState /></Card> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Halls" value={halls ?? 0} hint="Configured venues" icon={<LayoutGrid />} />
              <StatCard label="Confirmed bookings" value={confirmed} hint="Not yet held or cancelled" icon={<ClipboardList />} />
              <StatCard label="Events, next 30 days" value={next30.length} hint={next30[0] ? `Next: ${format(new Date(next30[0].booking_date), "MMM d")}` : "None scheduled"} icon={<CalendarDays />} />
              <StatCard label="Booked this month" value={lkr(monthValue)} hint="Excludes cancelled" icon={<Wallet />} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <SectionCard className="lg:col-span-2" title="Booked value by month" description="This month and the next five, excluding cancelled" bodyClassName="h-[260px] p-3">
                {byMonth.some((m) => m.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={gridStroke} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisTick} />
                      <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={compact} width={44} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                        formatter={(v) => [lkr(Number(v)), "Booked"]} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar dataKey="value" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="No upcoming bookings" description="Booked value appears here as events are booked." />}
              </SectionCard>

              <SectionCard title="Upcoming events"
                action={<Button variant="ghost" size="sm" asChild><Link href="/banquet/bookings">All <ChevronRight className="h-4 w-4" /></Link></Button>}>
                {upcoming.length === 0 ? <EmptyState title="Nothing scheduled" /> : (
                  <ul className="divide-y">
                    {upcoming.slice(0, 6).map((b) => (
                      <li key={b.id}>
                        <Link href={`/banquet/bookings/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{b.customer_name || b.booking_no}</span>
                            <span className="block text-xs text-muted-foreground">
                              {format(new Date(b.booking_date), "EEE, MMM d")}{b.session ? ` · ${b.session}` : ""}{b.hall_name ? ` · ${b.hall_name}` : ""}
                            </span>
                          </span>
                          <Badge variant={b.status === "Confirmed" ? "secondary" : "outline"} className="font-normal">{b.status}</Badge>
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
