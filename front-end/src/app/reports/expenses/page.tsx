"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReportShell } from "../_components/report-shell";
import { CompareBar, CompareTable, buildSeries, defaultCompare, mergeSeriesRows, useCompare, type CompareState, type Series } from "../_components/compare";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { downloadExcelGeneric as downloadCsv } from "@/lib/excel-export";
import { FileSpreadsheet, Loader2 } from "lucide-react";

type Row = { account_id: number; code: string; category: string; vouchers: number; total: number };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function fetchByCategory(from: string, to: string): Promise<Row[]> {
  const res = await api(`/api/expense/by_category?from=${from}&to=${to}`);
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.status !== "success") throw new Error(d.message || "Failed to load expenses");
  return (d.data || []).map((x: any) => ({ ...x, vouchers: Number(x.vouchers || 0), total: Number(x.total || 0) }));
}

export default function Page() {
  return <Suspense fallback={null}><ExpensesByCategory /></Suspense>;
}

function ExpensesByCategory() {
  const { toast } = useToast();
  const sp = useSearchParams();
  const isPrint = sp?.get("print") === "1";
  const now = new Date();
  const [from, setFrom] = useState(sp?.get("from") ?? iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(sp?.get("to") ?? iso(now));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setRows(await fetchByCategory(from, to)); }
    catch (e: any) { setRows([]); toast({ title: "Error", description: e?.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const total = rows.reduce((a, r) => a + r.total, 0);

  // Expenses have no branch, so only period and trend compare.
  const [compare, setCompare] = useState<CompareState>(defaultCompare);
  const series = useMemo(() => buildSeries(compare, { from, to, locationId: "all" }, []), [compare, from, to]);
  const fetchSeries = async (s: Series) => {
    const list = await fetchByCategory(s.from, s.to);
    return [
      ...list.map(r => ({ key: `a${r.account_id}`, label: r.code ? `${r.category} (${r.code})` : r.category, value: r.total })),
      { key: "__total", label: "Total expenses", value: list.reduce((a, r) => a + r.total, 0), kind: "grand" as const },
    ];
  };
  const cmp = useCompare(series, fetchSeries, compare.mode !== "off");
  const cmpRows = useMemo(() => {
    if (!cmp.results) return [];
    const merged = mergeSeriesRows(cmp.results);
    // keep the grand total last
    return [...merged.filter(r => r.key !== "__total"), ...merged.filter(r => r.key === "__total")];
  }, [cmp.results]);

  const printHref = `/reports/expenses?print=1&from=${from}&to=${to}`;

  return (
    <ReportShell
      title="Expenses by Category"
      subtitle="Paid expense vouchers grouped by expense account"
      filename="expenses-by-category"
      printHref={printHref}
      printMeta={<div className="text-sm"><span className="font-semibold">Period:</span> {from} to {to}</div>}
      actions={
        <Button variant="outline" onClick={() => downloadCsv(`expenses-by-category-${from}-to-${to}.csv`, rows.map(r => ({ Code: r.code, Category: r.category, Vouchers: r.vouchers, Amount: r.total.toFixed(2) })))} disabled={!rows.length}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
        </Button>
      }
    >
      {!isPrint && (
        <div className="space-y-3 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><div className="text-xs text-muted-foreground">From</div><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" /></div>
            <div className="space-y-1"><div className="text-xs text-muted-foreground">To</div><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" /></div>
            <Button onClick={() => void load()} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Run</Button>
          </div>
          <CompareBar value={compare} onChange={setCompare} locations={[]} allowLocation={false} />
        </div>
      )}

      {compare.mode !== "off" ? (
        <Card className="overflow-hidden" data-report-section>
          <CardHeader className="border-b py-3"><CardTitle className="text-base">{compare.mode === "period" ? "Period comparison" : "Monthly trend"}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <CompareTable series={series} rows={cmpRows} loading={cmp.loading} error={cmp.error} higherIsBetter={false} />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Expense account</th>
                  <th className="px-4 py-2.5 text-right font-medium">Vouchers</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount (LKR)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">No paid expenses in this period.</td></tr>
                ) : (
                  <>
                    {rows.map(r => (
                      <tr key={r.account_id}>
                        <td className="px-4 py-2">{r.category} {r.code && <span className="text-xs text-muted-foreground font-mono ml-1">{r.code}</span>}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.vouchers}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(r.total)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{total ? ((r.total / total) * 100).toFixed(1) : "0.0"}%</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-bold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-right tabular-nums">{rows.reduce((a, r) => a + r.vouchers, 0)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(total)}</td>
                      <td className="px-4 py-2 text-right">100%</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </ReportShell>
  );
}
