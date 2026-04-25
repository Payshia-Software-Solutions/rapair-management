"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReportShell } from "../../_components/report-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { fetchLocations, fetchSalesReportSummary, type ServiceLocationRow } from "@/lib/api";
import { Download, Loader2 } from "lucide-react";

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function firstDayOfMonth() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

function todayLocalDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function downloadCsv(filename: string, rows: Array<Record<string, any>>) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[\",\n]/.test(s)) return `"${s.replace(/\"/g, "\"\"")}"`;
    return s;
  };
  const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SalesSummaryReportPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isPrint = searchParams?.get("print") === "1";
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const [locations, setLocations] = useState<Array<{ value: string; label: string }>>([]);
  const [locationId, setLocationId] = useState<string>(() => searchParams?.get("location_id") ?? "all");
  const [from, setFrom] = useState<string>(() => searchParams?.get("from") ?? firstDayOfMonth());
  const [to, setTo] = useState<string>(() => searchParams?.get("to") ?? todayLocalDate());

  const decodeToken = () => {
    try {
      const token = window.localStorage.getItem("auth_token");
      if (!token) return null;
      const part = token.split(".")[1];
      return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  };

  const loadLocations = async () => {
    const tokenJson: any = decodeToken();
    const role = String(tokenJson?.role ?? "");
    if (role === "Admin") {
      const locRows = await fetchLocations();
      const opts = Array.isArray(locRows)
        ? (locRows as ServiceLocationRow[])
            .map((l) => ({ value: String(l.id), label: String(l.name ?? "") }))
            .filter((o) => o.value !== "0" && o.label)
        : [];
      setLocations([{ value: "all", label: "All Locations" }, ...opts]);
      return;
    }
    const allowed = Array.isArray(tokenJson?.allowed_locations) ? tokenJson.allowed_locations : [];
    const opts = allowed
      .map((x: any) => ({ value: String(x?.id), label: String(x?.name ?? "") }))
      .filter((o: any) => Number(o.value) > 0 && o.label);
    setLocations([{ value: "all", label: "All Allowed Locations" }, ...opts]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSalesReportSummary({
        location_id: locationId === "all" ? "all" : locationId,
        from,
        to,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setRows([]);
      toast({ title: "Error", description: e?.message || "Failed to load sales summary", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLocations().then(() => void load());
  }, []);

  const totals = useMemo(() => {
    let invoices = 0;
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    let grand = 0;
    let paid = 0;
    for (const r of rows) {
      invoices += Number(r.invoice_count ?? 0);
      subtotal += Number(r.total_subtotal ?? 0);
      tax += Number(r.total_tax ?? 0);
      discount += Number(r.total_discount ?? 0);
      grand += Number(r.total_grand ?? 0);
      paid += Number(r.total_paid ?? 0);
    }
    return { invoices, subtotal, tax, discount, grand, paid };
  }, [rows]);

  const printHref = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("print", "1");
    qs.set("autoprint", "1");
    qs.set("location_id", locationId);
    qs.set("from", from);
    qs.set("to", to);
    return `/reports/sales/summary?${qs.toString()}`;
  }, [locationId, from, to]);

  const locationLabel = useMemo(() => {
    return locations.find((o) => o.value === locationId)?.label ?? (locationId === "all" ? "All" : locationId);
  }, [locations, locationId]);

  return (
    <ReportShell
      title="Sale Summary Report"
      subtitle="Daily aggregation of sales totals (Excludes Cancelled Invoices)"
      actions={
        <>
          <Button asChild variant="outline"><Link href={printHref} target="_blank">Print</Link></Button>
          <Button asChild><Link href={printHref} target="_blank">Export PDF</Link></Button>
        </>
      }
      printMeta={
        <div className="space-y-1 text-sm">
          <div><span className="font-semibold">Location:</span> {locationLabel}</div>
          <div><span className="font-semibold">Period:</span> {from} to {to}</div>
        </div>
      }
    >
      {!isPrint ? (
        <Card className="border-none shadow-md overflow-hidden mb-6">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <div className="text-xs text-muted-foreground mb-1">Location</div>
                <SearchableSelect
                  value={locationId}
                  onValueChange={setLocationId}
                  options={locations}
                  placeholder="Select location..."
                />
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Run
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between gap-3 mt-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Invoices: {totals.invoices}</Badge>
                <Badge variant="outline">Subtotal: {money(totals.subtotal)}</Badge>
                <Badge variant="outline">Tax: {money(totals.tax)}</Badge>
                <Badge variant="outline">Discount: {money(totals.discount)}</Badge>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Grand Total: {money(totals.grand)}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadCsv(`sales-summary-${from}-to-${to}.csv`, rows)} disabled={loading || rows.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-none shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-center px-4 py-3">Invoices</th>
                  <th className="text-right px-4 py-3">Subtotal</th>
                  <th className="text-right px-4 py-3">Tax</th>
                  <th className="text-right px-4 py-3">Discount</th>
                  <th className="text-right px-4 py-3 font-bold">Grand Total</th>
                  <th className="text-right px-4 py-3">Paid</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No data found for the selected period.</td></tr>
                ) : (
                  <>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/5">
                        <td className="px-4 py-3 font-medium">{r.date}</td>
                        <td className="px-4 py-3 text-center">{r.invoice_count}</td>
                        <td className="px-4 py-3 text-right">{money(Number(r.total_subtotal))}</td>
                        <td className="px-4 py-3 text-right">{money(Number(r.total_tax))}</td>
                        <td className="px-4 py-3 text-right text-rose-600">{money(Number(r.total_discount))}</td>
                        <td className="px-4 py-3 text-right font-bold">{money(Number(r.total_grand))}</td>
                        <td className="px-4 py-3 text-right text-green-600">{money(Number(r.total_paid))}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/20 font-bold">
                      <td className="px-4 py-3">TOTAL</td>
                      <td className="px-4 py-3 text-center">{totals.invoices}</td>
                      <td className="px-4 py-3 text-right">{money(totals.subtotal)}</td>
                      <td className="px-4 py-3 text-right">{money(totals.tax)}</td>
                      <td className="px-4 py-3 text-right text-rose-600">{money(totals.discount)}</td>
                      <td className="px-4 py-3 text-right">{money(totals.grand)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{money(totals.paid)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </ReportShell>
  );
}
