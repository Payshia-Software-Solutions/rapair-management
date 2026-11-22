"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReportShell } from "../../_components/report-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { fetchLocations, fetchTaxInvoiceRegister, type ServiceLocationRow, type TaxRegister } from "@/lib/api";
import { AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadExcelGeneric } from "@/lib/excel-export";

const money = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n: number) => String(n).padStart(2, "0");
const firstDayOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/**
 * Tax Invoice Register: one line per invoice with net (base), service charge, every tax in its own
 * column and the total; a per-tax summary (taxable = tax / rate); and a warning for menu-price
 * bills that booked no taxes. For VAT returns and audits.
 */
export default function TaxInvoiceRegisterPage() {
  const { toast } = useToast();
  const sp = useSearchParams();
  const isPrint = sp?.get("print") === "1";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TaxRegister | null>(null);
  const [locations, setLocations] = useState<Array<{ value: string; label: string }>>([]);
  const [locationId, setLocationId] = useState(() => sp?.get("location_id") ?? "all");
  const [from, setFrom] = useState(() => sp?.get("from") ?? firstDayOfMonth());
  const [to, setTo] = useState(() => sp?.get("to") ?? today());
  const [mode, setMode] = useState(() => sp?.get("mode") ?? "all");
  const [status, setStatus] = useState(() => sp?.get("status") ?? "active");
  const [vatOnly, setVatOnly] = useState(() => sp?.get("vat_only") === "1");

  const loadLocations = async () => {
    try {
      const rows = await fetchLocations();
      const opts = Array.isArray(rows) ? (rows as ServiceLocationRow[]).map(l => ({ value: String(l.id), label: String(l.name ?? "") })).filter(o => o.label) : [];
      setLocations([{ value: "all", label: "All locations" }, ...opts]);
    } catch { setLocations([{ value: "all", label: "All locations" }]); }
  };

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchTaxInvoiceRegister({ location_id: locationId, from, to, mode, status, vat_only: vatOnly }));
    } catch (e: any) {
      setData(null);
      toast({ title: "Couldn't load the register", description: e?.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadLocations(); void load(); /* eslint-disable-next-line */ }, []);

  const cols = data?.tax_columns || [];
  const locationLabel = locations.find(o => o.value === locationId)?.label ?? "All locations";

  const printHref = useMemo(() => {
    const q = new URLSearchParams({ print: "1", autoprint: "1", location_id: locationId, from, to, mode, status });
    if (vatOnly) q.set("vat_only", "1");
    return `/reports/sales/tax-register?${q.toString()}`;
  }, [locationId, from, to, mode, status, vatOnly]);

  const exportExcel = () => {
    if (!data?.rows.length) return;
    const rows = data.rows.map(r => {
      const o: Record<string, any> = {
        date: r.issue_date, invoice_no: r.invoice_no, tax_invoice_no: r.tax_invoice_no || "",
        customer: r.customer_name || "", customer_vat_no: r.customer_tax_no || "", location: r.location_name || "",
        type: r.mode === "menu" ? "Menu price" : "Standard", status: r.status, net_base: r.net, service_charge: r.sc,
      };
      for (const c of cols) o[c.code.toLowerCase()] = r.taxes[c.code] || 0;
      o.total_tax = r.tax_total; o.invoice_total = r.total;
      return o;
    });
    void downloadExcelGeneric(`tax-invoice-register-${from}-to-${to}.xlsx`, rows);
  };

  return (
    <ReportShell
      printHref={printHref}
      title="Tax Invoice Register"
      subtitle="Net, service charge and each tax per invoice"
      
      printMeta={
        <div className="space-y-1 text-sm">
          <div><span className="font-semibold">Location:</span> {locationLabel}</div>
          <div><span className="font-semibold">Period:</span> {from} to {to}</div>
          {vatOnly && <div><span className="font-semibold">Customers:</span> VAT registered only</div>}
        </div>
      }
    >
      {!isPrint && (
        <Card className="border-none shadow-md overflow-hidden mb-5">
          <CardHeader className="border-b bg-muted/20 py-3"><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
              <div className="col-span-2 md:col-span-3">
                <div className="text-xs text-muted-foreground mb-1">Location</div>
                <SearchableSelect value={locationId} onValueChange={setLocationId} options={locations} placeholder="Location" />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground mb-1">From</div>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground mb-1">To</div>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Pricing</div>
                <select value={mode} onChange={e => setMode(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm" aria-label="Pricing type">
                  <option value="all">All invoices</option>
                  <option value="menu">Menu price (tax incl.)</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm" aria-label="Status">
                  <option value="active">Valid</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-2">
                <Button className="w-full" onClick={() => void load()} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Run
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={vatOnly} onCheckedChange={v => setVatOnly(!!v)} /> VAT registered customers only
              </label>
              <Button variant="outline" size="sm" onClick={exportExcel} disabled={loading || !data?.rows.length}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.missing_tax.length > 0 && !isPrint && (
        <div className="mb-5 flex gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <b>{data.missing_tax.length} menu-price invoice{data.missing_tax.length > 1 ? "s" : ""} booked no taxes</b> (service charge only),
            usually because the location had no taxes set when they were billed:{" "}
            {data.missing_tax.slice(0, 8).map(m => m.invoice_no).join(", ")}{data.missing_tax.length > 8 ? "…" : ""}
          </div>
        </div>
      )}

      {/* Summary by tax */}
      {data && data.summary.length > 0 && (
        <Card className="border-none shadow-md overflow-hidden mb-5">
          <CardHeader className="border-b bg-muted/20 py-3"><CardTitle className="text-base">Summary by tax</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Tax</th>
                  <th className="text-right px-4 py-2">Rate</th>
                  <th className="text-right px-4 py-2">Taxable amount</th>
                  <th className="text-right px-4 py-2">Tax</th>
                  <th className="text-right px-4 py-2">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.summary.map(s => (
                  <tr key={s.code + s.rate}>
                    <td className="px-4 py-2"><span className="font-medium">{s.code}</span> <span className="text-muted-foreground">{s.name}</span></td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(s.rate)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(s.taxable)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{money(s.amount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.invoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Register */}
      <Card className="border-none shadow-md overflow-hidden">
        <CardContent className="p-0">
          {!isPrint && data && (
            <div className="flex flex-wrap gap-2 p-3 border-b">
              <Badge variant="outline">Invoices: {data.rows.length}{data.truncated ? " (first 5,000)" : ""}</Badge>
              <Badge variant="outline">Net: {money(data.totals.net)}</Badge>
              <Badge variant="outline">SC: {money(data.totals.sc)}</Badge>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Tax: {money(data.totals.tax)}</Badge>
              <Badge variant="outline">Total: {money(data.totals.total)}</Badge>
            </div>
          )}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b text-xs text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Invoice</th>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-left px-3 py-2">VAT No</th>
                  <th className="text-left px-3 py-2">Location</th>
                  <th className="text-right px-3 py-2">Net</th>
                  <th className="text-right px-3 py-2">SC</th>
                  {cols.map(c => <th key={c.code} className="text-right px-3 py-2">{c.code}</th>)}
                  <th className="text-right px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={8 + cols.length} className="py-10 text-center text-muted-foreground">Loading…</td></tr>
                ) : !data || data.rows.length === 0 ? (
                  <tr><td colSpan={8 + cols.length} className="py-10 text-center text-muted-foreground">No invoices in this period.</td></tr>
                ) : data.rows.map(r => (
                  <tr key={r.id} className={/cancel/i.test(r.status) ? "text-muted-foreground line-through" : ""}>
                    <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{r.issue_date}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {isPrint ? r.invoice_no : <Link href={`/cms/invoices/${r.id}/view`} className="text-primary hover:underline">{r.invoice_no}</Link>}
                      {r.mode === "menu" && <span className="ml-1.5 text-[10px] text-muted-foreground">menu</span>}
                    </td>
                    <td className="px-3 py-1.5 max-w-[12rem] truncate">{r.customer_name || "—"}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.customer_tax_no || ""}</td>
                    <td className="px-3 py-1.5 max-w-[10rem] truncate">{r.location_name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money(r.net)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.sc ? money(r.sc) : "—"}</td>
                    {cols.map(c => <td key={c.code} className="px-3 py-1.5 text-right tabular-nums">{r.taxes[c.code] ? money(r.taxes[c.code]) : "—"}</td>)}
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              {data && data.rows.length > 0 && (
                <tfoot className="border-t-2 font-semibold bg-muted/20">
                  <tr>
                    <td className="px-3 py-2" colSpan={5}>Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.net)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.sc)}</td>
                    {cols.map(c => <td key={c.code} className="px-3 py-2 text-right tabular-nums">{money(data.totals.taxes[c.code] || 0)}</td>)}
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </ReportShell>
  );
}
