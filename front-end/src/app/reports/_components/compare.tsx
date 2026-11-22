"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Shared "Compare" for reports. Three modes:
 *  - period:   this range vs previous period / same time last year / custom range
 *  - location: same dates, one column per chosen branch
 *  - trend:    last 3/6/12 months, one column per month
 * A report gives its base filters + a fetcher; it gets back one result per column ("series")
 * and renders them with <CompareTable> (rows = lines, columns = series, plus change columns).
 */

export type CompareMode = "off" | "period" | "location" | "trend";
export type Series = { key: string; label: string; from: string; to: string; locationId: string };
export type CompareState = {
  mode: CompareMode;
  period: "prev" | "year" | "custom";
  cfrom: string;
  cto: string;
  locations: string[];
  months: number;
};
export type LocOption = { value: string; label: string };

export const defaultCompare = (): CompareState => ({ mode: "off", period: "prev", cfrom: "", cto: "", locations: [], months: 6 });

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => new Date(s + "T00:00:00");
const nice = (s: string) => parse(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const rangeLabel = (f: string, t: string) => (f === t ? nice(f) : `${nice(f)} – ${nice(t)}`);

/** Same-length range just before [from, to]. */
export function previousRange(from: string, to: string): [string, string] {
  const f = parse(from), t = parse(to);
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const b = new Date(f); b.setDate(b.getDate() - 1);
  const a = new Date(b); a.setDate(a.getDate() - days + 1);
  return [iso(a), iso(b)];
}
export function lastYearRange(from: string, to: string): [string, string] {
  const a = parse(from); a.setFullYear(a.getFullYear() - 1);
  const b = parse(to); b.setFullYear(b.getFullYear() - 1);
  return [iso(a), iso(b)];
}

/** Columns to fetch for the current compare settings. Off = just the base range. */
export function buildSeries(c: CompareState, base: { from: string; to: string; locationId: string }, locs: LocOption[]): Series[] {
  const baseLabel = rangeLabel(base.from, base.to);
  const one: Series = { key: "base", label: baseLabel, from: base.from, to: base.to, locationId: base.locationId };
  if (c.mode === "period") {
    const [f, t] = c.period === "prev" ? previousRange(base.from, base.to)
      : c.period === "year" ? lastYearRange(base.from, base.to)
      : [c.cfrom || base.from, c.cto || base.to];
    return [one, { key: "cmp", label: rangeLabel(f, t), from: f, to: t, locationId: base.locationId }];
  }
  if (c.mode === "location") {
    const ids = c.locations.length ? c.locations : locs.filter(l => l.value !== "all").slice(0, 3).map(l => l.value);
    return ids.map(id => ({ key: `loc-${id}`, label: locs.find(l => l.value === id)?.label || `Location ${id}`, from: base.from, to: base.to, locationId: id }));
  }
  if (c.mode === "trend") {
    const end = parse(base.to);
    const out: Series[] = [];
    for (let i = c.months - 1; i >= 0; i--) {
      const start = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const last = new Date(end.getFullYear(), end.getMonth() - i + 1, 0);
      const stop = last > end ? end : last;
      out.push({
        key: `m-${iso(start)}`,
        label: start.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
        from: iso(start), to: iso(stop), locationId: base.locationId,
      });
    }
    return out;
  }
  return [one];
}

/** Runs the fetcher once per series (in parallel) whenever the series change. */
export function useCompare<T>(series: Series[], fetcher: (s: Series) => Promise<T>, enabled: boolean) {
  const [results, setResults] = React.useState<T[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sig = JSON.stringify(series);
  const fetchRef = React.useRef(fetcher);
  fetchRef.current = fetcher;

  React.useEffect(() => {
    if (!enabled) { setResults(null); return; }
    let live = true;
    setLoading(true); setError(null);
    Promise.all(series.map(s => fetchRef.current(s)))
      .then(r => { if (live) setResults(r); })
      .catch(e => { if (live) { setResults(null); setError(e?.message || "Couldn't load the comparison"); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, enabled]);

  return { results, loading, error };
}

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/** Compare controls. `locations` empty or `allowLocation=false` hides the branch mode. */
export function CompareBar({ value, onChange, locations, allowLocation = true }: {
  value: CompareState; onChange: (c: CompareState) => void; locations: LocOption[]; allowLocation?: boolean;
}) {
  const set = (p: Partial<CompareState>) => onChange({ ...value, ...p });
  const branchOpts = locations.filter(l => l.value !== "all");
  const canLoc = allowLocation && branchOpts.length > 1;
  const modes: [CompareMode, string][] = [["off", "Off"], ["period", "Period vs period"], ...(canLoc ? [["location", "Branch vs branch"] as [CompareMode, string]] : []), ["trend", "Monthly trend"]];

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3 print:hidden" data-pdf-hide>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium mr-1">Compare</span>
        <div className="inline-flex flex-wrap rounded-md bg-background border p-0.5" role="tablist" aria-label="Compare mode">
          {modes.map(([m, l]) => (
            <button key={m} type="button" role="tab" aria-selected={value.mode === m} onClick={() => set({ mode: m })}
              className={`h-8 px-3 rounded-sm text-sm ${value.mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>

      {value.mode === "period" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Against</span>
          <select className={sel} value={value.period} onChange={e => set({ period: e.target.value as CompareState["period"] })} aria-label="Compare against">
            <option value="prev">Previous period (same length)</option>
            <option value="year">Same dates last year</option>
            <option value="custom">Custom dates</option>
          </select>
          {value.period === "custom" && (
            <>
              <Input type="date" className="h-9 w-40" aria-label="Compare from" value={value.cfrom} onChange={e => set({ cfrom: e.target.value })} />
              <span className="text-muted-foreground">to</span>
              <Input type="date" className="h-9 w-40" aria-label="Compare to" value={value.cto} onChange={e => set({ cto: e.target.value })} />
            </>
          )}
        </div>
      )}

      {value.mode === "location" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Branches</span>
          {branchOpts.map(l => {
            const on = value.locations.includes(l.value) || (!value.locations.length && branchOpts.slice(0, 3).some(b => b.value === l.value));
            return (
              <button key={l.value} type="button" aria-pressed={on}
                onClick={() => {
                  const cur = value.locations.length ? value.locations : branchOpts.slice(0, 3).map(b => b.value);
                  const next = on ? cur.filter(x => x !== l.value) : [...cur, l.value];
                  if (next.length) set({ locations: next });
                }}
                className={`h-8 px-3 rounded-full border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>{l.label}</button>
            );
          })}
        </div>
      )}

      {value.mode === "trend" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Months up to the “To” date</span>
          {[3, 6, 12].map(n => (
            <button key={n} type="button" onClick={() => set({ months: n })} aria-pressed={value.months === n}
              className={`h-8 px-3 rounded-full border ${value.months === n ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>Last {n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export type CompareRow = { key: string; label: string; values: number[]; depth?: number; kind?: "header" | "total" | "grand" | "line"; format?: "money" | "count" };

const fmtMoney = (n: number) => {
  if (Math.abs(n) < 0.005) return "–";
  const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
};
const fmtCount = (n: number) => (n ? n.toLocaleString() : "–");

/**
 * Rows × series table. Two series → adds "Change" and "%" (first vs second).
 * More than two → adds a Total column (trend) and highlights each month's change vs the month before.
 * `higherIsBetter=false` (expenses) shows increases in red.
 */
export function CompareTable({ series, rows, loading, error, higherIsBetter = true, showTotal }: {
  series: Series[]; rows: CompareRow[]; loading?: boolean; error?: string | null; higherIsBetter?: boolean; showTotal?: boolean;
}) {
  const two = series.length === 2;
  const total = showTotal ?? series.length > 2;
  const cols = series.length + (two ? 2 : 0) + (total ? 1 : 0) + 1;

  const tone = (d: number) => {
    if (Math.abs(d) < 0.005) return "text-muted-foreground";
    return (d > 0) === higherIsBetter ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  };

  if (loading && !rows.length) {
    return <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Comparing…</div>;
  }
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;

  return (
    <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">LKR</th>
            {series.map((s, i) => (
              <th key={s.key} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                {s.label}{two && i === 0 ? " (now)" : ""}
              </th>
            ))}
            {two && <th className="px-3 py-2 text-right font-medium">Change</th>}
            {two && <th className="px-3 py-2 text-right font-medium">%</th>}
            {total && <th className="px-3 py-2 text-right font-medium">Total</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && <tr><td colSpan={cols} className="p-8 text-center text-muted-foreground">No data for these periods.</td></tr>}
          {rows.map(r => {
            if (r.kind === "header") {
              return <tr key={r.key}><td colSpan={cols} className="px-3 pt-4 pb-1 font-semibold">{r.label}</td></tr>;
            }
            const f = r.format === "count" ? fmtCount : fmtMoney;
            const d = two ? (r.values[0] || 0) - (r.values[1] || 0) : 0;
            const pct = two && Math.abs(r.values[1] || 0) >= 0.005 ? (d / Math.abs(r.values[1])) * 100 : null;
            const strong = r.kind === "total" || r.kind === "grand";
            return (
              <tr key={r.key} className={r.kind === "grand" ? "font-bold bg-muted/40" : strong ? "font-semibold" : ""}>
                <td className="px-3 py-1.5" style={{ paddingLeft: 12 + (r.depth || 0) * 16 }}>{r.label}</td>
                {series.map((s, i) => {
                  const v = r.values[i] || 0;
                  // Trend: colour each month against the one before it.
                  const prev = !two && series.length > 2 && i > 0 ? r.values[i - 1] || 0 : null;
                  return (
                    <td key={s.key} className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${prev !== null && !strong ? tone(v - prev) : ""}`}>{f(v)}</td>
                  );
                })}
                {two && (
                  <td className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${tone(d)}`}>
                    <span className="inline-flex items-center gap-0.5">
                      {Math.abs(d) >= 0.005 && (d > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />)}
                      {Math.abs(d) < 0.005 ? "–" : (d > 0 ? "+" : "−") + f(Math.abs(d))}
                    </span>
                  </td>
                )}
                {two && (
                  <td className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${tone(d)}`}>
                    {pct === null ? (Math.abs(r.values[0] || 0) >= 0.005 ? "new" : "–") : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                  </td>
                )}
                {total && <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap font-medium">{f(r.values.reduce((a, b) => a + (b || 0), 0))}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Merge per-series row lists (each with one value) into rows with one value per series, keeping order. */
export function mergeSeriesRows(perSeries: { key: string; label: string; value: number; depth?: number; kind?: CompareRow["kind"]; format?: CompareRow["format"] }[][]): CompareRow[] {
  const order: string[] = [];
  const meta = new Map<string, CompareRow>();
  // Longest list first gives the most complete ordering; then append anything missing.
  const byLen = perSeries.map((rows, i) => ({ rows, i })).sort((a, b) => b.rows.length - a.rows.length);
  for (const { rows } of byLen) {
    rows.forEach((r, idx) => {
      if (meta.has(r.key)) return;
      meta.set(r.key, { key: r.key, label: r.label, depth: r.depth, kind: r.kind, format: r.format, values: new Array(perSeries.length).fill(0) });
      // insert after the previous row of this list if we know it
      const prevKey = idx > 0 ? rows[idx - 1].key : null;
      const at = prevKey ? order.indexOf(prevKey) : -1;
      if (at >= 0) order.splice(at + 1, 0, r.key); else order.push(r.key);
    });
  }
  perSeries.forEach((rows, si) => rows.forEach(r => { const m = meta.get(r.key); if (m) m.values[si] = r.value; }));
  return order.map(k => meta.get(k)!);
}
