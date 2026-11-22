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
import { fetchLocations, fetchMenuTaxBreakdown, type MenuTaxBreakdown, type ServiceLocationRow } from "@/lib/api";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadExcelGeneric as downloadCsv } from "@/lib/excel-export";

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

/**
 * Internal report for menu-pricing (tax-inclusive) locations.
 * Left block = what the customer saw (menu price + SC = net).
 * Right block = what was booked (base + SC = subtotal, then each tax = net).
 */
export function MenuTaxReport({ groupBy }: { groupBy: "item" | "invoice" }) {
  const byInvoice = groupBy === "invoice";
  const route = byInvoice ? "/reports/sales/menu-tax-invoices" : "/reports/sales/menu-tax";
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isPrint = searchParams?.get("print") === "1";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MenuTaxBreakdown | null>(null);

  const [locations, setLocations] = useState<Array<{ value: string; label: string }>>([]);
  const [locationId, setLocationId] = useState<string>(() => searchParams?.get("location_id") ?? "all");
  const [from, setFrom] = useState<string>(() => searchParams?.get("from") ?? firstDayOfMonth());
  const [to, setTo] = useState<string>(() => searchParams?.get("to") ?? todayLocalDate());

  const loadLocations = async () => {
    try {
      const locRows = await fetchLocations();
      const opts = Array.isArray(locRows)
        ? (locRows as ServiceLocationRow[])
            .map((l) => ({ value: String(l.id), label: String(l.name ?? "") }))
            .filter((o) => o.value !== "0" && o.label)
        : [];
      setLocations([{ value: "all", label: "All Locations" }, ...opts]);
    } catch {
      setLocations([{ value: "all", label: "All Locations" }]);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchMenuTaxBreakdown({ location_id: locationId, from, to, group_by: groupBy });
      setData(res && Array.isArray(res.rows) ? res : null);
    } catch (e: any) {
      setData(null);
      toast({ title: "Error", description: e?.message || "Failed to load report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLocations().then(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const taxCodes = data?.tax_codes ?? [];
  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const printHref = useMemo(() => {
    const qs = new URLSearchParams({ print: "1", autoprint: "1", location_id: locationId, from, to });
    return `${route}?${qs.toString()}`;
  }, [locationId, from, to, route]);

  const locationLabel = locations.find((o) => o.value === locationId)?.label ?? locationId;

  const exportCsv = () => {
    const flat = rows.map((r) => {
      const o: Record<string, any> = {
        ...(byInvoice ? { Invoice: r.description, Date: r.issue_date ?? "", Customer: r.customer_name ?? "" } : { Item: r.description }),
        Qty: r.qty,
        "Menu Net (excl. SC)": r.display_net,
        "SC (shown)": r.display_sc,
        "Customer Paid": r.display_total,
        "Base Price": r.base,
        "Service Charge": r.sc,
        Subtotal: r.subtotal,
      };
      for (const c of taxCodes) o[c] = r.taxes[c] ?? 0;
      o["Net"] = r.net;
      return o;
    });
    downloadCsv(`menu-tax-${byInvoice ? "invoices" : "items"}-${from}-to-${to}.csv`, flat);
  };

  const colCount = (byInvoice ? 11 : 9) + taxCodes.length;

  return (
    <ReportShell
      printHref={printHref}
      title={byInvoice ? "Menu Pricing Tax by Invoice" : "Menu Pricing Tax Breakdown"}
      subtitle={byInvoice ? "Each tax-inclusive menu invoice split into base price, service charge and each tax" : "Internal view of tax-inclusive menu sales: base price, service charge and each tax"}
      actions={
        <>
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Run
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Invoices: {data?.invoice_count ?? 0}</Badge>
                <Badge variant="outline">Customer paid: {money(totals?.display_total ?? 0)}</Badge>
                <Badge variant="outline">Base: {money(totals?.base ?? 0)}</Badge>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Taxes: {money(Object.values(totals?.taxes ?? {}).reduce((s, v) => s + Number(v), 0))}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || rows.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-none shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-muted/30 border-b">
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2" colSpan={byInvoice ? 4 : 2}></th>
                  <th className="px-4 py-2 text-center border-l" colSpan={3}>Shown to customer</th>
                  <th className="px-4 py-2 text-center border-l" colSpan={4 + taxCodes.length}>Booked internally</th>
                </tr>
                <tr>
                  {byInvoice ? (
                    <>
                      <th className="text-left px-4 py-3">Invoice</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Customer</th>
                    </>
                  ) : (
                    <th className="text-left px-4 py-3">Item</th>
                  )}
                  <th className="text-right px-4 py-3">{byInvoice ? "Items" : "Qty"}</th>
                  <th className="text-right px-4 py-3 border-l">Menu net</th>
                  <th className="text-right px-4 py-3">SC</th>
                  <th className="text-right px-4 py-3 font-bold">Paid</th>
                  <th className="text-right px-4 py-3 border-l">Base price</th>
                  <th className="text-right px-4 py-3">Service charge</th>
                  <th className="text-right px-4 py-3">Subtotal</th>
                  {taxCodes.map((c) => (
                    <th key={c} className="text-right px-4 py-3">{c}</th>
                  ))}
                  <th className="text-right px-4 py-3 font-bold">Net</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={colCount} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="py-12 text-center text-muted-foreground">
                      No menu-pricing sales in this period. Turn on “Menu pricing (taxes included)” in the location settings to use this mode.
                    </td>
                  </tr>
                ) : (
                  <>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/5">
                        {byInvoice ? (
                          <>
                            <td className="px-4 py-2.5 font-medium">
                              {r.invoice_id ? <Link href={`/cms/invoices/${r.invoice_id}/view`} className="text-primary hover:underline">{r.description}</Link> : r.description}
                            </td>
                            <td className="px-4 py-2.5">{r.issue_date}</td>
                            <td className="px-4 py-2.5">{r.customer_name}</td>
                          </>
                        ) : (
                          <td className="px-4 py-2.5 font-medium">{r.description}</td>
                        )}
                        <td className="px-4 py-2.5 text-right tabular-nums">{Number(r.qty)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums border-l">{money(r.display_net)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.display_sc)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold">{money(r.display_total)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums border-l">{money(r.base)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.sc)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(r.subtotal)}</td>
                        {taxCodes.map((c) => (
                          <td key={c} className="px-4 py-2.5 text-right tabular-nums">{money(r.taxes[c] ?? 0)}</td>
                        ))}
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-primary">{money(r.net)}</td>
                      </tr>
                    ))}
                    {totals && (
                      <tr className="bg-muted/20 font-bold">
                        <td className="px-4 py-3" colSpan={byInvoice ? 3 : 1}>TOTAL</td>
                        <td className="px-4 py-3 text-right tabular-nums">{Number(totals.qty)}</td>
                        <td className="px-4 py-3 text-right tabular-nums border-l">{money(totals.display_net)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(totals.display_sc)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(totals.display_total)}</td>
                        <td className="px-4 py-3 text-right tabular-nums border-l">{money(totals.base)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(totals.sc)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(totals.subtotal)}</td>
                        {taxCodes.map((c) => (
                          <td key={c} className="px-4 py-3 text-right tabular-nums">{money(totals.taxes[c] ?? 0)}</td>
                        ))}
                        <td className="px-4 py-3 text-right tabular-nums text-primary">{money(totals.net)}</td>
                      </tr>
                    )}
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
