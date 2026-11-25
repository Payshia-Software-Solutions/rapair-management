"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Download, Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchCompany, fetchLocations } from "@/lib/api";
import { fetchBalanceSheet, fetchCashFlow, fetchPnl, type BalanceSheet, type CashFlow, type FsNode, type Pnl } from "@/lib/api/financials";
import { downloadExcelGeneric as downloadCsv } from "@/lib/excel-export";
import { CompareBar, CompareTable, buildSeries, defaultCompare, mergeSeriesRows, useCompare, type CompareState, type Series } from "@/app/reports/_components/compare";

type Tab = "pnl" | "bs" | "cf";
type Compare = "none" | "prev" | "year";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const fmt = (v: number | undefined) => {
  const n = Number(v || 0);
  if (Math.abs(n) < 0.005) return "–";
  const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
};
const niceDate = (s?: string | null) => s ? new Date(s + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

function shift(from: string, to: string, mode: Compare): [string, string] | null {
  if (mode === "none") return null;
  const f = new Date(from + "T00:00:00"), t = new Date(to + "T00:00:00");
  if (mode === "year") {
    const a = new Date(f); a.setFullYear(a.getFullYear() - 1);
    const b = new Date(t); b.setFullYear(b.getFullYear() - 1);
    return [iso(a), iso(b)];
  }
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const b = new Date(f); b.setDate(b.getDate() - 1);
  const a = new Date(b); a.setDate(a.getDate() - days + 1);
  return [iso(a), iso(b)];
}

const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "month", label: "This month", range: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), today()]; } },
  { key: "lastmonth", label: "Last month", range: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]; } },
  { key: "quarter", label: "This quarter", range: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)), today()]; } },
  // Sri Lankan tax year runs April–March
  { key: "fy", label: "This financial year (Apr–Mar)", range: () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return [`${y}-04-01`, today()]; } },
  { key: "year", label: "This calendar year", range: () => [`${new Date().getFullYear()}-01-01`, today()] },
];

/** Account lines down to the chosen level (2 = groups, 3 = sub-groups, 4 = every ledger). */
function Lines({ nodes, depth, maxLevel, cols, indentBase = 0 }: { nodes: FsNode[]; depth: number; maxLevel: number; cols: number; indentBase?: number }) {
  return (
    <>
      {nodes.map(n => {
        if (n.level > maxLevel) return null;
        const showKids = n.children.length > 0 && n.level < maxLevel;
        const ledger = !n.is_group;
        return (
          <React.Fragment key={n.id}>
            <tr className={showKids ? "font-medium" : ""}>
              <td className="py-1.5 pr-3" style={{ paddingLeft: 12 + (indentBase + depth) * 18 }}>
                {ledger
                  ? <Link href={`/accounting/accounts/${n.id}/ledger`} className="hover:underline print:no-underline">{n.name}</Link>
                  : n.name}
                <span className="ml-2 text-xs text-muted-foreground font-mono print:hidden">{n.code}</span>
              </td>
              {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className={`py-1.5 px-3 text-right tabular-nums whitespace-nowrap ${showKids ? "text-muted-foreground" : ""}`}>
                  {showKids ? "" : fmt(n.values[i])}
                </td>
              ))}
            </tr>
            {showKids && <Lines nodes={n.children} depth={depth + 1} maxLevel={maxLevel} cols={cols} indentBase={indentBase} />}
            {showKids && (
              <tr className="font-medium">
                <td className="py-1.5 pr-3 text-muted-foreground" style={{ paddingLeft: 12 + (indentBase + depth) * 18 }}>Total {n.name.toLowerCase()}</td>
                {Array.from({ length: cols }).map((_, i) => (
                  <td key={i} className="py-1.5 px-3 text-right tabular-nums border-t">{fmt(n.values[i])}</td>
                ))}
              </tr>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

function TotalRow({ label, values, cols, strong }: { label: string; values: number[]; cols: number; strong?: boolean }) {
  return (
    <tr className={strong ? "font-bold text-base" : "font-semibold"}>
      <td className="py-2 pr-3 pl-3">{label}</td>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className={`py-2 px-3 text-right tabular-nums whitespace-nowrap ${strong ? "border-t-2 border-b-4 border-double border-foreground/60" : "border-t"}`}>{fmt(values[i])}</td>
      ))}
    </tr>
  );
}

function flatten(nodes: FsNode[], maxLevel: number, out: { Account: string; Code: string; values: number[] }[] = [], depth = 0) {
  for (const n of nodes) {
    if (n.level > maxLevel) continue;
    out.push({ Account: "  ".repeat(depth) + n.name, Code: n.code, values: n.values });
    if (n.level < maxLevel) flatten(n.children, maxLevel, out, depth + 1);
  }
  return out;
}

function pnlRows(p: Pnl, maxLevel: number) {
  type R = { key: string; label: string; value: number; depth?: number; kind?: "header" | "total" | "grand" | "line" };
  const out: R[] = [];
  const walk = (nodes: FsNode[], depth: number) => {
    for (const n of nodes) {
      if (n.level > maxLevel) continue;
      out.push({ key: `n${n.id}`, label: n.name, value: Number(n.values[0] || 0), depth });
      if (n.children.length && n.level < maxLevel) walk(n.children, depth + 1);
    }
  };
  for (const sec of p.sections) {
    if (sec.kind === "total" || sec.kind === "grand") {
      out.push({ key: `s-${sec.key}`, label: sec.label, value: Number(sec.values[0] || 0), kind: sec.kind });
    } else {
      out.push({ key: `h-${sec.key}`, label: sec.label, value: 0, kind: "header" });
      if (sec.lines) walk(sec.lines, 1);
      out.push({ key: `t-${sec.key}`, label: `Total ${sec.label.toLowerCase()}`, value: Number(sec.values[0] || 0), kind: "total" });
    }
  }
  return out;
}

export default function FinancialStatementsPage() {
  const { toast } = useToast();
  const sp = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(["bs", "cf"].includes(String(sp?.get("tab"))) ? (sp!.get("tab") as Tab) : "pnl");
  const [preset, setPreset] = useState("fy");
  const [[from, to], setRange] = useState<[string, string]>(PRESETS.find(p => p.key === "fy")!.range());
  const [asOf, setAsOf] = useState(today());
  const [compare, setCompare] = useState<Compare>("none");
  const [level, setLevel] = useState(3);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [cf, setCf] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [loc, setLoc] = useState("all");

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchLocations().then((r: any) => setLocations(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  // P&L uses the shared report compare (period / branch / monthly trend); the balance sheet keeps `compare`.
  const [pnlCmp, setPnlCmp] = useState<CompareState>(defaultCompare);
  const locOpts = useMemo(() => [{ value: "all", label: "Whole company" }, ...locations.map(l => ({ value: String(l.id), label: l.name }))], [locations]);
  const pnlSeries = useMemo(() => buildSeries(pnlCmp, { from, to, locationId: loc }, locOpts), [pnlCmp, from, to, loc, locOpts]);
  const pnlCmpOn = tab === "pnl" && pnlCmp.mode !== "off";
  const fetchPnlSeries = async (sr: Series) => pnlRows(await fetchPnl({ from: sr.from, to: sr.to, ...(sr.locationId && sr.locationId !== "all" ? { location_id: sr.locationId } : {}) }), level);
  const pnlCmpRes = useCompare(pnlSeries, fetchPnlSeries, pnlCmpOn);
  const pnlCmpRows = useMemo(() => (pnlCmpRes.results ? mergeSeriesRows(pnlCmpRes.results) : []), [pnlCmpRes.results]);
  // level change must refetch the compare (rows depend on it)
  useEffect(() => { if (pnlCmpOn) setPnlCmp(c => ({ ...c })); }, [level]); // eslint-disable-line react-hooks/exhaustive-deps

  const cmpRange = useMemo(() => (tab !== "bs" ? null : shift(from, to, compare)), [from, to, compare, tab]);
  const cmpAsOf = useMemo(() => {
    if (compare === "none") return null;
    const d = new Date(asOf + "T00:00:00");
    if (compare === "year") d.setFullYear(d.getFullYear() - 1); else { d.setDate(0); }
    return iso(d);
  }, [asOf, compare]);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const lp = loc !== "all" ? { location_id: loc } : {};
      if (tab === "pnl") setPnl(await fetchPnl({ ...lp, from, to, ...(cmpRange ? { cfrom: cmpRange[0], cto: cmpRange[1] } : {}) }));
      else if (tab === "cf") setCf(await fetchCashFlow({ ...lp, from, to }));
      else setBs(await fetchBalanceSheet({ ...lp, as_of: asOf, ...(cmpAsOf ? { cas_of: cmpAsOf } : {}) }));
    } catch (e: any) {
      toast({ title: "Couldn't build the statement", description: e?.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [tab, from, to, cmpRange, asOf, cmpAsOf, loc, toast]);
  useEffect(() => { void run(); }, [run]);

  const switchTab = (t: Tab) => { setTab(t); router.replace(`/accounting/statements?tab=${t}`); };
  const cols = tab !== "bs" || compare === "none" ? 1 : 2;

  const heads = tab !== "bs"
    ? [`${niceDate(from)} – ${niceDate(to)}`, cmpRange ? `${niceDate(cmpRange[0])} – ${niceDate(cmpRange[1])}` : ""]
    : [niceDate(asOf), cmpAsOf ? niceDate(cmpAsOf) : ""];

  const exportCsv = () => {
    const rows: Record<string, any>[] = [];
    const push = (Account: string, values: number[], Code = "") => {
      const o: Record<string, any> = { Code, Account };
      heads.slice(0, cols).forEach((h, i) => { o[h] = Number(values[i] || 0).toFixed(2); });
      rows.push(o);
    };
    if (pnlCmpOn) {
      for (const row of pnlCmpRows) {
        if (row.kind === "header") continue;
        const o: Record<string, any> = { Account: "  ".repeat(row.depth || 0) + row.label };
        pnlSeries.forEach((sr, i) => { o[sr.label] = Number(row.values[i] || 0).toFixed(2); });
        if (pnlSeries.length === 2) o["Change"] = (Number(row.values[0] || 0) - Number(row.values[1] || 0)).toFixed(2);
        rows.push(o);
      }
      downloadCsv(`profit-and-loss-compare-${from}-to-${to}.csv`, rows);
      return;
    }
    if (tab === "cf" && cf) {
      for (const row of cashFlowRows(cf)) if (row.kind !== "head") push(row.label, [row.amount ?? 0], row.code || "");
      downloadCsv(`cash-flow-${from}-to-${to}.csv`, rows);
      return;
    }
    if (tab === "pnl" && pnl) {
      for (const s of pnl.sections) {
        if (s.lines) flatten(s.lines, level).forEach(r => push(r.Account, r.values, r.Code));
        push(s.kind === "total" || s.kind === "grand" ? s.label.toUpperCase() : `Total ${s.label.toLowerCase()}`, s.values);
      }
    } else if (bs) {
      for (const [label, sec] of [["Assets", bs.assets], ["Liabilities", bs.liabilities], ["Equity", bs.equity]] as const) {
        flatten(sec.lines, level).forEach(r => push(r.Account, r.values, r.Code));
        if (label === "Equity") push("Profit for the period (not yet closed)", bs.equity.profit);
        push(`TOTAL ${label.toUpperCase()}`, sec.total);
      }
      push("TOTAL LIABILITIES AND EQUITY", bs.total_le);
    }
    downloadCsv(`${tab === "pnl" ? `profit-and-loss-${from}-to-${to}` : `balance-sheet-${asOf}`}.csv`, rows);
  };

  // Print in its own A4 layout (letterhead, sign-off) instead of printing this screen
  const openPrint = () => {
    const q = new URLSearchParams({ tab, level: String(level) });
    if (loc !== "all") q.set("location_id", loc);
    if (tab === "bs") { q.set("as_of", asOf); if (cmpAsOf) q.set("cas_of", cmpAsOf); }
    else { q.set("from", from); q.set("to", to); }
    window.open(`/accounting/statements/print?${q.toString()}`, "_blank");
  };

  const headerRow = (
    <thead>
      <tr className="text-xs text-muted-foreground border-b">
        <th className="py-2 pl-3 pr-3 text-left font-medium">LKR</th>
        {heads.slice(0, cols).map((h, i) => <th key={i} className="py-2 px-3 text-right font-medium whitespace-nowrap w-40">{h}</th>)}
      </tr>
    </thead>
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financial Statements</h1>
            <p className="text-sm text-muted-foreground mt-1">Profit &amp; loss, balance sheet and cash flow straight from the books, in SLFRS / IAS 1 and IAS 7 layout.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={exportCsv} disabled={loading}><Download className="h-4 w-4 mr-2" aria-hidden="true" /> CSV</Button>
            <Button onClick={openPrint} disabled={loading}><Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Print / PDF</Button>
          </div>
        </div>

        {/* Controls */}
        <Card className="p-3 space-y-3 print:hidden">
          <div className="inline-flex rounded-md bg-muted p-1" role="tablist" aria-label="Statement">
            {([["pnl", "Profit & loss"], ["bs", "Balance sheet"], ["cf", "Cash flow"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}
                className={`h-8 px-4 rounded-sm text-sm font-medium ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr] items-end">
            {tab !== "bs" ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="preset">Period</Label>
                  <select id="preset" value={preset} onChange={e => { setPreset(e.target.value); const p = PRESETS.find(x => x.key === e.target.value); if (p) setRange(p.range()); }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    <option value="custom">Custom dates</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="from">From</Label>
                  <Input id="from" type="date" value={from} onChange={e => { setPreset("custom"); setRange([e.target.value, to]); }} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to">To</Label>
                  <Input id="to" type="date" value={to} onChange={e => { setPreset("custom"); setRange([from, e.target.value]); }} />
                </div>
              </>
            ) : (
              <div className="space-y-1 lg:col-span-3">
                <Label htmlFor="asof">As at</Label>
                <Input id="asof" type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="max-w-xs" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="loc">Branch</Label>
              <select id="loc" value={loc} onChange={e => setLoc(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">Whole company</option>
                {locations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
              </select>
            </div>
            {tab === "bs" && <div className="space-y-1">
              <Label htmlFor="cmp">Compare with</Label>
              <select id="cmp" value={compare} onChange={e => setCompare(e.target.value as Compare)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="none">Nothing</option>
                <option value="prev">End of previous month</option>
                <option value="year">Same time last year</option>
              </select>
            </div>}
            <div className="space-y-1">
              <Label htmlFor="lvl">Detail</Label>
              <select id="lvl" value={level} onChange={e => setLevel(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value={2}>Summary (groups)</option>
                <option value={3}>Standard (sub-groups)</option>
                <option value={4}>Full (every ledger)</option>
              </select>
            </div>
          </div>
        </Card>

        {tab === "pnl" && <CompareBar value={pnlCmp} onChange={setPnlCmp} locations={locOpts} />}

        {/* Statement */}
        <Card className="p-4 sm:p-6 print:shadow-none print:border-0 print:p-0">
          <div className="mb-4 text-center">
            {company?.name && <p className="font-semibold">{company.name}</p>}
            <h2 className="text-lg font-bold">{tab === "pnl" ? "Statement of Profit or Loss" : tab === "cf" ? "Statement of Cash Flows" : "Statement of Financial Position"}</h2>
            <p className="text-sm text-muted-foreground">{tab !== "bs" ? `For the period ${niceDate(from)} to ${niceDate(to)}` : `As at ${niceDate(asOf)}`}</p>
            {loc !== "all" && <p className="text-sm text-muted-foreground">Branch: {locations.find(l => String(l.id) === loc)?.name || loc}</p>}
          </div>

          {loading && !(tab === "pnl" ? pnl : tab === "cf" ? cf : bs) ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Building…</div>
          ) : pnlCmpOn ? (
            <CompareTable series={pnlSeries} rows={pnlCmpRows} loading={pnlCmpRes.loading} error={pnlCmpRes.error} />
          ) : tab === "pnl" && pnl ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {headerRow}
                <tbody>
                  {pnl.sections.map(s => s.kind === "total" || s.kind === "grand" ? (
                    <TotalRow key={s.key} label={s.label} values={s.values} cols={cols} strong={s.kind === "grand"} />
                  ) : (s.lines?.length || s.values.some(v => Math.abs(v) >= 0.005)) ? (
                    <React.Fragment key={s.key}>
                      <tr><td colSpan={cols + 1} className="pt-4 pb-1 pl-3 font-semibold">{s.label}</td></tr>
                      {s.lines && <Lines nodes={s.lines} depth={1} maxLevel={level} cols={cols} />}
                      <TotalRow label={`Total ${s.label.toLowerCase()}`} values={s.values} cols={cols} />
                    </React.Fragment>
                  ) : null)}
                  <tr><td colSpan={cols + 1} className="pt-4" /></tr>
                  <tr className="text-muted-foreground">
                    <td className="py-1 pl-3">Gross margin</td>
                    {pnl.margins.gross.slice(0, cols).map((m, i) => <td key={i} className="py-1 px-3 text-right tabular-nums">{m === null ? "–" : `${m}%`}</td>)}
                  </tr>
                  <tr className="text-muted-foreground">
                    <td className="py-1 pl-3">Net margin</td>
                    {pnl.margins.net.slice(0, cols).map((m, i) => <td key={i} className="py-1 px-3 text-right tabular-nums">{m === null ? "–" : `${m}%`}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : tab === "cf" && cf ? (
            <CashFlowTable cf={cf} branch={loc !== "all"} />
          ) : tab === "bs" && bs ? (
            <>
              <div className={`mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm print:hidden ${bs.balanced.every(Boolean) ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
                {bs.balanced.every(Boolean) ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                {bs.balanced.every(Boolean) ? "Assets equal liabilities plus equity." : loc !== "all" ? "A single branch may not balance on its own: some entries (expenses, supplier payments, journals) have no branch." : "Assets don't equal liabilities plus equity. Run the Posting Check."}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  {headerRow}
                  <tbody>
                    <tr><td colSpan={cols + 1} className="pt-3 pb-1 pl-3 font-semibold">Assets</td></tr>
                    <Lines nodes={bs.assets.lines} depth={1} maxLevel={level} cols={cols} />
                    <TotalRow label="Total assets" values={bs.assets.total} cols={cols} strong />
                    <tr><td colSpan={cols + 1} className="pt-6 pb-1 pl-3 font-semibold">Equity and liabilities</td></tr>
                    <tr><td colSpan={cols + 1} className="pt-2 pb-1 pl-6 font-medium">Equity</td></tr>
                    <Lines nodes={bs.equity.lines} depth={2} maxLevel={level} cols={cols} />
                    <tr>
                      <td className="py-1.5 pr-3" style={{ paddingLeft: 12 + 2 * 18 }}>Profit for the period (not yet closed)</td>
                      {Array.from({ length: cols }).map((_, i) => <td key={i} className="py-1.5 px-3 text-right tabular-nums">{fmt(bs.equity.profit[i])}</td>)}
                    </tr>
                    <TotalRow label="Total equity" values={bs.equity.total} cols={cols} />
                    <tr><td colSpan={cols + 1} className="pt-3 pb-1 pl-6 font-medium">Liabilities</td></tr>
                    <Lines nodes={bs.liabilities.lines} depth={2} maxLevel={level} cols={cols} />
                    <TotalRow label="Total liabilities" values={bs.liabilities.total} cols={cols} />
                    <TotalRow label="Total equity and liabilities" values={bs.total_le} cols={cols} strong />
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          <p className="mt-6 text-xs text-muted-foreground print:mt-10">
            Built from posted journal entries. Run Accounting → Posting Check first so every sale, payment and stock change is included.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
}

type CfRow = { kind: "head" | "line" | "total" | "grand"; label: string; amount?: number; code?: string; indent?: number };

/** Flat rows of the cash flow statement (shared by the table and the CSV export). */
function cashFlowRows(cf: CashFlow): CfRow[] {
  const rows: CfRow[] = [];
  rows.push({ kind: "head", label: "Cash flows from operating activities" });
  rows.push({ kind: "line", label: "Profit for the period", amount: cf.operating.net_profit, indent: 1 });
  if (Math.abs(cf.operating.depreciation) >= 0.005) rows.push({ kind: "line", label: "Add back: depreciation", amount: cf.operating.depreciation, indent: 1 });
  if (cf.operating.working_capital.length) rows.push({ kind: "line", label: "Changes in working capital", indent: 1 });
  for (const l of cf.operating.working_capital) {
    const what = l.amount < 0 ? (l.code.startsWith("2") ? "Decrease in" : "Increase in") : (l.code.startsWith("2") ? "Increase in" : "Decrease in");
    rows.push({ kind: "line", label: `${what} ${l.name.toLowerCase()}`, amount: l.amount, code: l.code, indent: 2 });
  }
  rows.push({ kind: "total", label: "Net cash from operating activities", amount: cf.operating.total });
  rows.push({ kind: "head", label: "Cash flows from investing activities" });
  for (const l of cf.investing.lines) rows.push({ kind: "line", label: l.amount < 0 ? `Purchase of ${l.name.toLowerCase()}` : `Sale of ${l.name.toLowerCase()}`, amount: l.amount, code: l.code, indent: 1 });
  rows.push({ kind: "total", label: "Net cash from investing activities", amount: cf.investing.total });
  rows.push({ kind: "head", label: "Cash flows from financing activities" });
  for (const l of cf.financing.lines) rows.push({ kind: "line", label: l.name, amount: l.amount, code: l.code, indent: 1 });
  rows.push({ kind: "total", label: "Net cash from financing activities", amount: cf.financing.total });
  rows.push({ kind: "grand", label: "Net increase / (decrease) in cash", amount: cf.net_change });
  rows.push({ kind: "line", label: "Cash and cash equivalents at the start", amount: cf.opening_cash });
  rows.push({ kind: "grand", label: "Cash and cash equivalents at the end", amount: cf.closing_cash });
  return rows;
}

function CashFlowTable({ cf, branch }: { cf: CashFlow; branch: boolean }) {
  const ok = Math.abs(cf.difference) < 0.01;
  return (
    <>
      <div className={`mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm print:hidden ${ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
        {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
        {ok ? "Opening cash plus the net change equals closing cash."
          : branch ? "A single branch may not reconcile on its own: some entries have no branch."
          : `Off by ${fmt(cf.difference)}. Run the Posting Check.`}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="py-2 pl-3 pr-3 text-left font-medium">LKR</th>
              <th className="py-2 px-3 text-right font-medium whitespace-nowrap w-40">Amount</th>
            </tr>
          </thead>
          <tbody>
            {cashFlowRows(cf).map((row, i) => row.kind === "head" ? (
              <tr key={i}><td colSpan={2} className="pt-4 pb-1 pl-3 font-semibold">{row.label}</td></tr>
            ) : row.kind === "line" ? (
              <tr key={i}>
                <td className="py-1.5 pr-3" style={{ paddingLeft: 12 + (row.indent || 0) * 18 }}>{row.label}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{row.amount === undefined ? "" : fmt(row.amount)}</td>
              </tr>
            ) : (
              <TotalRow key={i} label={row.label} values={[row.amount || 0]} cols={1} strong={row.kind === "grand"} />
            ))}
          </tbody>
        </table>
      </div>
      {cf.non_cash.length > 0 && (
        <div className="mt-5 rounded-md border p-3 text-sm">
          <div className="font-medium">Non-cash transactions (not in the statement)</div>
          <p className="text-xs text-muted-foreground mb-2">Entries that moved no cash, such as opening stock put into the books against capital.</p>
          {cf.non_cash.map((n, i) => (
            <div key={i} className="flex justify-between"><span>{n.description} ({n.count})</span><span className="tabular-nums">{fmt(n.amount)}</span></div>
          ))}
        </div>
      )}
    </>
  );
}
