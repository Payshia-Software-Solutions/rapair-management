"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReportShell } from "../../_components/report-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { fetchLocations, fetchCompVoidReport, type ServiceLocationRow } from "@/lib/api";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadExcelGeneric as downloadCsv } from "@/lib/excel-export";

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const pad = (n: number) => String(n).padStart(2, "0");
function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function when(s: string) {
  if (!s) return "";
  const d = new Date(String(s).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Group rows and total their amounts, largest first. */
function summarise(rows: any[], key: string) {
  const m = new Map<string, { count: number; amount: number }>();
  for (const r of rows) {
    const k = String(r[key] || "—");
    const cur = m.get(k) || { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += Number(r.amount || 0);
    m.set(k, cur);
  }
  return Array.from(m.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount);
}

export default function CompsVoidsReportPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isPrint = searchParams?.get("print") === "1";
  const [loading, setLoading] = useState(true);
  const [comps, setComps] = useState<any[]>([]);
  const [voids, setVoids] = useState<any[]>([]);

  const [locations, setLocations] = useState<Array<{ value: string; label: string }>>([]);
  const [locationId, setLocationId] = useState<string>(() => searchParams?.get("location_id") ?? "all");
  const [from, setFrom] = useState<string>(() => searchParams?.get("from") ?? firstDayOfMonth());
  const [to, setTo] = useState<string>(() => searchParams?.get("to") ?? todayLocalDate());

  const loadLocations = async () => {
    try {
      const rows = await fetchLocations();
      const opts = Array.isArray(rows)
        ? (rows as ServiceLocationRow[]).map((l) => ({ value: String(l.id), label: String(l.name ?? "") })).filter((o) => o.value !== "0" && o.label)
        : [];
      setLocations([{ value: "all", label: "All Locations" }, ...opts]);
    } catch {
      setLocations([{ value: "all", label: "All Locations" }]);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCompVoidReport({ from, to, location_id: locationId === "all" ? null : locationId });
      setComps(data.comps || []);
      setVoids(data.voids || []);
    } catch (e: any) {
      setComps([]); setVoids([]);
      toast({ title: "Error", description: e?.message || "Failed to load report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLocations().then(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compTotal = useMemo(() => comps.reduce((s, r) => s + Number(r.amount || 0), 0), [comps]);
  const voidTotal = useMemo(() => voids.reduce((s, r) => s + Number(r.amount || 0), 0), [voids]);
  const byApprover = useMemo(() => summarise(comps, "approved_by"), [comps]);
  const byReason = useMemo(() => summarise(comps, "reason"), [comps]);

  const printHref = useMemo(() => {
    const qs = new URLSearchParams({ print: "1", autoprint: "1", location_id: locationId, from, to });
    return `/reports/sales/comps-voids?${qs.toString()}`;
  }, [locationId, from, to]);
  const locationLabel = locations.find((o) => o.value === locationId)?.label ?? "All";

  const th = "py-2 px-3 text-left text-xs font-medium text-muted-foreground";
  const td = "py-2 px-3 align-top";

  return (
    <ReportShell
      printHref={printHref}
      title="Comps & Voids"
      subtitle="Complimentary items on settled bills, and items removed after they were sent to the kitchen"
      printMeta={
        <div className="space-y-1 text-sm">
          <div><span className="font-semibold">Location:</span> {locationLabel}</div>
          <div><span className="font-semibold">Period:</span> {from} to {to}</div>
        </div>
      }
    >
      {!isPrint && (
        <Card className="border-none shadow-md overflow-hidden mb-6">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <div className="text-xs text-muted-foreground mb-1">Location</div>
                <SearchableSelect value={locationId} onValueChange={setLocationId} options={locations} placeholder="Select location..." />
              </div>
              <div className="md:col-span-3">
                <div className="text-xs text-muted-foreground mb-1">From</div>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <div className="text-xs text-muted-foreground mb-1">To</div>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Button className="w-full" onClick={() => void load()} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Run
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="outline">Comps: {comps.length} · LKR {money(compTotal)}</Badge>
              <Badge variant="outline">Voids: {voids.length} · LKR {money(voidTotal)}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[{ title: "Comps by approver", rows: byApprover }, { title: "Comps by reason", rows: byReason }].map((g) => (
              <Card key={g.title} className="border-none shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-base">{g.title}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {g.rows.length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-muted-foreground">No complimentary items in this period.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b"><th className={th}>Name</th><th className={`${th} text-right`}>Lines</th><th className={`${th} text-right`}>Value (LKR)</th></tr></thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={r.name} className="border-b last:border-0">
                            <td className={td}>{r.name}</td>
                            <td className={`${td} text-right tabular-nums`}>{r.count}</td>
                            <td className={`${td} text-right tabular-nums`}>{money(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-base">Complimentary items</CardTitle>
              {!isPrint && (
                <Button variant="outline" size="sm" onClick={() => downloadCsv(`comps-${from}-to-${to}.csv`, comps)} disabled={comps.length === 0}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />CSV
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {comps.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No complimentary items in this period.</p>
              ) : (
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className={th}>Date</th><th className={th}>Invoice</th><th className={th}>Item</th>
                      <th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Value (LKR)</th>
                      <th className={th}>Reason</th><th className={th}>Approved by</th><th className={th}>Billed by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comps.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className={`${td} whitespace-nowrap`}>{when(r.created_at)}</td>
                        <td className={td}>
                          {isPrint ? r.invoice_no : <Link href={`/cms/invoices/${r.invoice_id}/view`} className="text-primary hover:underline">{r.invoice_no}</Link>}
                          {r.table_name && <div className="text-xs text-muted-foreground">Table {r.table_name}</div>}
                        </td>
                        <td className={td}>{r.description}</td>
                        <td className={`${td} text-right tabular-nums`}>{Number(r.quantity)}</td>
                        <td className={`${td} text-right tabular-nums`}>{money(Number(r.amount))}</td>
                        <td className={td}>{r.reason}</td>
                        <td className={td}>{r.approved_by}</td>
                        <td className={td}>{r.billed_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-base">Voids after KOT</CardTitle>
              {!isPrint && (
                <Button variant="outline" size="sm" onClick={() => downloadCsv(`voids-${from}-to-${to}.csv`, voids)} disabled={voids.length === 0}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />CSV
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {voids.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No items were removed after KOT in this period.</p>
              ) : (
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className={th}>Date</th><th className={th}>Table</th><th className={th}>Item</th>
                      <th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Value (LKR)</th>
                      <th className={th}>Reason</th><th className={th}>Approved by</th><th className={th}>Removed by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voids.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className={`${td} whitespace-nowrap`}>{when(r.created_at)}</td>
                        <td className={td}>{r.table_name || `Order #${r.held_order_id}`}</td>
                        <td className={td}>{r.description}</td>
                        <td className={`${td} text-right tabular-nums`}>{Number(r.quantity)}</td>
                        <td className={`${td} text-right tabular-nums`}>{money(Number(r.amount))}</td>
                        <td className={td}>{r.reason}</td>
                        <td className={td}>{r.approved_by}</td>
                        <td className={td}>{r.removed_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </ReportShell>
  );
}
