"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchCompany, fetchLocations, type CompanyRow } from "@/lib/api";
import { PrintDocument } from "@/components/print/PrintDocument";
import { fetchBalanceSheet, fetchCashFlow, fetchPnl } from "@/lib/api/financials";
import { balanceSheetRows, cashFlowStatementRows, fmtAmount, pnlStatementRows, type StatementRow } from "@/lib/financial-statement-rows";

/**
 * Print layout for the financial statements (A4 portrait), opened in a new tab from
 * Accounting -> Financial Statements:
 *   /accounting/statements/print?tab=pnl&from=&to=[&cfrom=&cto=]&level=3[&location_id=]
 *   /accounting/statements/print?tab=bs&as_of=[&cas_of=]&level=3[&location_id=]
 *   /accounting/statements/print?tab=cf&from=&to=[&location_id=]
 * The print dialog opens once the statement has loaded.
 */
const TITLES: Record<string, string> = {
  pnl: "Statement of Profit or Loss",
  bs: "Statement of Financial Position",
  cf: "Statement of Cash Flows",
};
const niceDate = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

function StatementPrint() {
  const sp = useSearchParams();
  const tab = (["pnl", "bs", "cf"].includes(String(sp.get("tab"))) ? sp.get("tab") : "pnl") as "pnl" | "bs" | "cf";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const asOf = sp.get("as_of") || "";
  const casOf = sp.get("cas_of") || "";
  const cfrom = sp.get("cfrom") || "";
  const cto = sp.get("cto") || "";
  const level = Number(sp.get("level") || 3);
  const loc = sp.get("location_id") || "";

  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [branch, setBranch] = useState("");
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [heads, setHeads] = useState<string[]>([]);
  const [note, setNote] = useState<React.ReactNode>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const lp = loc ? { location_id: loc } : {};
        const [comp, locs] = await Promise.all([fetchCompany().catch(() => null), loc ? fetchLocations().catch(() => []) : Promise.resolve([])]);
        setCompany(comp);
        if (loc) setBranch((locs as any[]).find((l: any) => String(l.id) === loc)?.name || "");
        if (tab === "pnl") {
          const p = await fetchPnl({ ...lp, from, to, ...(cfrom && cto ? { cfrom, cto } : {}) });
          setRows(pnlStatementRows(p, level));
          setHeads([`${niceDate(from)} – ${niceDate(to)}`, ...(cfrom && cto ? [`${niceDate(cfrom)} – ${niceDate(cto)}`] : [])]);
        } else if (tab === "bs") {
          const b = await fetchBalanceSheet({ ...lp, as_of: asOf, ...(casOf ? { cas_of: casOf } : {}) });
          setRows(balanceSheetRows(b, level));
          setHeads([niceDate(asOf), ...(casOf ? [niceDate(casOf)] : [])]);
        } else {
          const c = await fetchCashFlow({ ...lp, from, to });
          setRows(cashFlowStatementRows(c));
          setHeads(["Amount"]);
          if (c.non_cash.length) {
            setNote(
              <div className="mt-6 text-[11px]">
                <div className="font-bold uppercase tracking-wider text-[10px] mb-1">Non-cash transactions (not included above)</div>
                {c.non_cash.map((n, i) => (
                  <div key={i} className="flex justify-between border-b border-slate-100 py-0.5"><span>{n.description} ({n.count})</span><span className="tabular-nums">{fmtAmount(n.amount)}</span></div>
                ))}
              </div>
            );
          }
        }
      } catch (e: any) {
        setError(e?.message || "Could not build the statement.");
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, from, to, asOf, casOf, cfrom, cto, level, loc]);


  const cols = heads.length;
  const period = tab === "bs" ? `As at ${niceDate(asOf)}` : `${niceDate(from)} to ${niceDate(to)}`;

  return (
    <PrintDocument
      title={TITLES[tab]}
      loading={loading}
      error={error || null}
      ready={rows.length > 0}
      company={company}
      meta={[[tab === "bs" ? "As at" : "Period", period], ["Currency", "LKR"], ...(branch ? [["Branch", branch] as [string, string]] : [])]}
      footerNote="Generated from posted journal entries."
    >
      <table className="w-full">
        <thead>
          <tr className="border-y-2 border-slate-900">
            <th className="text-left py-1.5" />
            {heads.map((h, i) => <th key={i} className="text-right py-1.5 pl-3 font-semibold whitespace-nowrap w-[34mm]">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pad = { paddingLeft: `${(r.depth || 0) * 5}mm` };
            if (r.kind === "spacer") return <tr key={i}><td colSpan={cols + 1} className="py-2" /></tr>;
            if (r.kind === "head") return <tr key={i}><td colSpan={cols + 1} className="pt-3 pb-1 font-bold uppercase text-[10.5px]">{r.label}</td></tr>;
            if (r.kind === "subhead" || r.kind === "group") return <tr key={i}><td colSpan={cols + 1} className={`pt-1.5 pb-0.5 ${r.kind === "subhead" ? "font-bold" : "font-semibold"}`} style={pad}>{r.label}</td></tr>;
            const strong = r.kind === "total" || r.kind === "grand" || r.kind === "subtotal";
            return (
              <tr key={i} className={strong ? "font-semibold" : ""}>
                <td className="py-[3px] pr-2" style={pad}>{r.label}</td>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className={`py-[3px] pl-3 text-right tabular-nums whitespace-nowrap ${
                    r.kind === "grand" ? "border-t border-slate-900 border-b-[3px] border-double font-bold"
                    : r.kind === "total" || r.kind === "subtotal" ? "border-t border-slate-400" : ""}`}>
                    {fmtAmount(r.values?.[c])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {note}
    </PrintDocument>
  );
}


export default function StatementPrintPage() {
  return (
    <Suspense fallback={null}>
      <StatementPrint />
    </Suspense>
  );
}
