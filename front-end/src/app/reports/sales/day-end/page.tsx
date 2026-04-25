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
import { fetchLocations, fetchDayEndSalesReport, type ServiceLocationRow } from "@/lib/api";
import { Loader2, Printer } from "lucide-react";

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayLocalDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DayEndReportPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isPrint = searchParams?.get("print") === "1";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const [locations, setLocations] = useState<Array<{ value: string; label: string }>>([]);
  const [locationId, setLocationId] = useState<string>(() => searchParams?.get("location_id") ?? "1");
  const [date, setDate] = useState<string>(() => searchParams?.get("date") ?? todayLocalDate());

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
      setLocations(opts);
      if (opts.length > 0 && !searchParams?.get("location_id")) setLocationId(opts[0].value);
      return;
    }
    const allowed = Array.isArray(tokenJson?.allowed_locations) ? tokenJson.allowed_locations : [];
    const opts = allowed
      .map((x: any) => ({ value: String(x?.id), label: String(x?.name ?? "") }))
      .filter((o: any) => Number(o.value) > 0 && o.label);
    setLocations(opts);
    if (opts.length > 0 && !searchParams?.get("location_id")) setLocationId(opts[0].value);
  };

  const load = async () => {
    if (!locationId || locationId === "all") {
      toast({ title: "Note", description: "Please select a specific location for Day End report." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetchDayEndSalesReport({
        location_id: locationId,
        date,
      });
      setData(res);
    } catch (e: any) {
      setData(null);
      toast({ title: "Error", description: e?.message || "Failed to load day end report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLocations().then(() => void load());
  }, []);

  const printHref = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("print", "1");
    qs.set("autoprint", "1");
    qs.set("location_id", locationId);
    qs.set("date", date);
    return `/reports/sales/day-end?${qs.toString()}`;
  }, [locationId, date]);

  const locationLabel = useMemo(() => {
    return locations.find((o) => o.value === locationId)?.label ?? locationId;
  }, [locations, locationId]);

  return (
    <ReportShell
      title="Day End Sales Report"
      subtitle="Complete daily financial closure"
      actions={
        <>
          <Button asChild variant="outline"><Link href={printHref} target="_blank"><Printer className="w-4 h-4 mr-2" /> Print</Link></Button>
        </>
      }
      printMeta={
        <div className="space-y-1 text-sm">
          <div><span className="font-semibold">Location:</span> {locationLabel}</div>
          <div><span className="font-semibold">Date:</span> {date}</div>
        </div>
      }
    >
      {!isPrint ? (
        <Card className="border-none shadow-md overflow-hidden mb-6">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg">Select Date & Location</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <div className="text-xs text-muted-foreground mb-1">Location</div>
                <SearchableSelect
                  value={locationId}
                  onValueChange={setLocationId}
                  options={locations}
                  placeholder="Select location..."
                />
              </div>
              <div className="md:col-span-4">
                <div className="text-xs text-muted-foreground mb-1">Date</div>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Button className="w-full" onClick={() => void load()} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Run Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border shadow-none">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-base uppercase tracking-wider">Sales Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Invoices Generated</span>
                <span className="font-bold">{data.summary.invoice_count}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Sales Value (Gross)</span>
                <span className="font-bold">{money(Number(data.summary.total_sales))}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-rose-600">
                <span className="">Total Sales Returns</span>
                <span className="font-bold">({money(Number(data.returns))})</span>
              </div>
              <div className="border-t pt-4 flex justify-between items-center text-lg font-black">
                <span>NET SALES</span>
                <span>{money(Number(data.summary.total_sales) - Number(data.returns))}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-none">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-base uppercase tracking-wider">Collections (Payments)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Method</th>
                    <th className="text-right px-4 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground italic">No payments recorded.</td></tr>
                  ) : (
                    data.payments.map((p: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="px-4 py-3 font-medium">{p.payment_method}</td>
                        <td className="px-4 py-3 text-right font-bold">{money(Number(p.total))}</td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-green-50/50 font-black">
                    <td className="px-4 py-3">TOTAL CASH & BANK INFLOW</td>
                    <td className="px-4 py-3 text-right text-green-700">{money(Number(data.summary.total_received))}</td>
                  </tr>
                </tbody>
              </table>
              <div className="p-4 text-[10px] text-muted-foreground text-center">
                * Note: Total received includes payments for previous invoices and today's invoices.
              </div>
            </CardContent>
          </Card>
          
          <Card className="border shadow-none md:col-span-2">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-base uppercase tracking-wider">Discrepancy Check</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 uppercase">Today's Sales (Net)</div>
                  <div className="text-xl font-bold">{money(Number(data.summary.total_sales) - Number(data.returns))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 uppercase">Total Payments Collected</div>
                  <div className="text-xl font-bold">{money(Number(data.summary.total_received))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 uppercase">Difference (Credit Sales)</div>
                  <div className="text-xl font-bold text-blue-600">
                    {money(Number(data.summary.total_sales) - Number(data.returns) - Number(data.summary.total_received))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="py-20 text-center text-muted-foreground">Please run the report to view data.</div>
      )}
    </ReportShell>
  );
}
