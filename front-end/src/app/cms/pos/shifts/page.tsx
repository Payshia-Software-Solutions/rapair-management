"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Wallet, AlertTriangle, Clock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard, StatCard, EmptyState, theadClass } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { posShiftApi, type PosShift } from "@/lib/api/pos-shifts";

const money = (v: any) => Number(v || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default function CashierShiftsPage() {
  const { toast } = useToast();
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [rows, setRows] = useState<PosShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PosShift | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await posShiftApi.list(from, to)); }
    catch (e: any) { toast({ title: "Could not load shifts", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }, [from, to, toast]);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const closed = rows.filter(r => r.status === "Closed");
    return {
      open: rows.filter(r => r.status === "Open").length,
      short: closed.filter(r => Number(r.variance) < 0).reduce((s, r) => s + Number(r.variance), 0),
      over: closed.filter(r => Number(r.variance) > 0).reduce((s, r) => s + Number(r.variance), 0),
      off: closed.filter(r => Number(r.variance) !== 0).length,
    };
  }, [rows]);

  const openDetail = async (id: number) => {
    try { setDetail(await posShiftApi.details(id)); }
    catch (e: any) { toast({ title: "Could not open shift", description: e.message, variant: "destructive" }); }
  };

  return (
    <DashboardLayout title="Cashier Shifts">
      <div className="space-y-6">
        <PageHeader title="Cashier Shifts" description="Every POS drawer session: opening cash, what should be in the drawer, what was counted, and the difference." />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Open now" value={stats.open} icon={<Clock className="h-4 w-4" />} />
          <StatCard label="Shifts off" value={stats.off} hint="Closed with a difference" icon={<AlertTriangle className="h-4 w-4" />} />
          <StatCard label="Total short" value={`LKR ${money(stats.short)}`} icon={<Wallet className="h-4 w-4" />} />
          <StatCard label="Total over" value={`LKR ${money(stats.over)}`} icon={<Wallet className="h-4 w-4" />} />
        </div>

        <SectionCard
          title="Shifts"
          action={
            <div className="flex items-end gap-2">
              <div><Label htmlFor="sh-from" className="text-xs">From</Label><Input id="sh-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" /></div>
              <div><Label htmlFor="sh-to" className="text-xs">To</Label><Input id="sh-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" /></div>
            </div>
          }
        >
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <EmptyState title="No shifts" description="Cashiers open a shift when they start the POS." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2 font-medium">Shift</th>
                    <th className="px-4 py-2 font-medium">Cashier</th>
                    <th className="px-4 py-2 font-medium">Location</th>
                    <th className="px-4 py-2 font-medium">Terminal</th>
                    <th className="px-4 py-2 font-medium">Opened</th>
                    <th className="px-4 py-2 font-medium">Closed</th>
                    <th className="px-4 py-2 font-medium text-right">Expected</th>
                    <th className="px-4 py-2 font-medium text-right">Counted</th>
                    <th className="px-4 py-2 font-medium text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const v = Number(r.variance || 0);
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(r.id)}>
                        <td className="px-4 py-2.5 font-mono">{r.shift_no}</td>
                        <td className="px-4 py-2.5">{r.user_name}</td>
                        <td className="px-4 py-2.5">{r.location_name}</td>
                        <td className="px-4 py-2.5">{r.terminal_name || "–"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{r.opened_at}</td>
                        <td className="px-4 py-2.5 tabular-nums">{r.status === "Open" ? <Badge variant="outline" className="border-none bg-emerald-500/10 text-emerald-700">Open</Badge> : r.closed_at}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.expected_cash != null ? money(r.expected_cash) : "–"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.counted_cash != null ? money(r.counted_cash) : "–"}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.status === "Closed" ? (v === 0 ? "text-emerald-600" : "text-rose-600") : ""}`}>
                          {r.status === "Closed" ? money(v) : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shift {detail?.shift_no}</DialogTitle>
            <DialogDescription>{detail?.terminal_name ? `${detail.terminal_name} · ` : ""}{detail?.user_name} · {detail?.location_name} · {detail?.opened_at} to {detail?.closed_at || "now"}</DialogDescription>
          </DialogHeader>
          {detail?.summary && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1 rounded-lg border p-3">
                {[
                  ["Opening cash", detail.summary.opening_float],
                  ["Cash sales", detail.summary.cash_sales],
                  ["Gift vouchers sold (cash)", detail.summary.voucher_cash],
                  ["Pay ins", detail.summary.pay_in],
                  ["Pay outs", -detail.summary.pay_out],
                  ["Cash refunds", -detail.summary.cash_refunds],
                ].filter(([l, v]) => Number(v) !== 0 || l === "Opening cash" || l === "Cash sales").map(([l, v]) => (
                  <div key={String(l)} className="flex justify-between"><span>{l}</span><span className="tabular-nums">{money(v)}</span></div>
                ))}
                <div className="flex justify-between font-semibold"><span>Expected cash</span><span className="tabular-nums">{money(detail.summary.expected_cash)}</span></div>
                {detail.counted_cash != null && <div className="flex justify-between font-semibold"><span>Counted cash</span><span className="tabular-nums">{money(detail.counted_cash)}</span></div>}
                {detail.status === "Closed" && (
                  <div className={`flex justify-between font-semibold ${Number(detail.variance) === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    <span>Difference</span><span className="tabular-nums">{money(detail.variance)}</span>
                  </div>
                )}
                {detail.close_notes && <p className="pt-1 text-muted-foreground">Note: {detail.close_notes}</p>}
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <div className="text-xs font-medium text-muted-foreground">Payments taken</div>
                {Object.entries(detail.summary.methods || {}).map(([m, v]) => (
                  <div key={m} className="flex justify-between"><span>{m} ({v.count})</span><span className="tabular-nums">{money(v.total)}</span></div>
                ))}
                <div className="flex justify-between"><span>Invoices ({detail.summary.invoice_count})</span><span className="tabular-nums">{money(detail.summary.sales_total)}</span></div>
              </div>
              {(detail.summary.moves || []).length > 0 && (
                <div className="space-y-1 rounded-lg border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Pay ins and outs</div>
                  {detail.summary.moves.map((m, i) => (
                    <div key={i} className="flex justify-between"><span>{m.type === "PayIn" ? "In" : "Out"} · {m.reason}</span><span className="tabular-nums">{money(m.type === "PayIn" ? m.amount : -Number(m.amount))}</span></div>
                  ))}
                </div>
              )}
              {detail.denominations && (
                <div className="space-y-1 rounded-lg border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Count</div>
                  {Object.entries(detail.denominations).sort((a, b) => Number(b[0]) - Number(a[0])).map(([d, n]) => (
                    <div key={d} className="flex justify-between"><span>{d} × {n}</span><span className="tabular-nums">{money(Number(d) * Number(n))}</span></div>
                  ))}
                </div>
              )}
            </div>
          )}
          {detail && (
            <div className="flex justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => window.open(`/cms/pos/shifts/print/${detail.id}`, "_blank")}>
                <Printer className="mr-1.5 h-4 w-4" /> Print summary
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
