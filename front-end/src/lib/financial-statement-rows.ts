import type { BalanceSheet, CashFlow, FsNode, Pnl } from "@/lib/api/financials";

/**
 * Flat rows for the financial statements, shared by the on-screen statement, the CSV export and
 * the print page. values[] has one entry per column (current period, optional comparison).
 */
export type StatementRow = {
  kind: "head" | "subhead" | "line" | "group" | "subtotal" | "total" | "grand" | "spacer";
  label: string;
  values?: number[];
  depth?: number;
  code?: string;
};

/** Account tree down to maxLevel (2 groups, 3 sub-groups, 4 every ledger), with group totals. */
export function treeRows(nodes: FsNode[], maxLevel: number, depth: number, out: StatementRow[] = []) {
  for (const n of nodes) {
    if (n.level > maxLevel) continue;
    const showKids = n.children.length > 0 && n.level < maxLevel;
    if (showKids) {
      out.push({ kind: "group", label: n.name, depth, code: n.code });
      treeRows(n.children, maxLevel, depth + 1, out);
      out.push({ kind: "subtotal", label: `Total ${n.name.toLowerCase()}`, values: n.values, depth });
    } else {
      out.push({ kind: "line", label: n.name, values: n.values, depth, code: n.code });
    }
  }
  return out;
}

export function pnlStatementRows(p: Pnl, maxLevel: number): StatementRow[] {
  const rows: StatementRow[] = [];
  for (const s of p.sections) {
    if (s.kind === "total" || s.kind === "grand") {
      rows.push({ kind: s.kind === "grand" ? "grand" : "total", label: s.label, values: s.values });
      continue;
    }
    if (!(s.lines?.length || s.values.some(v => Math.abs(v) >= 0.005))) continue;
    rows.push({ kind: "head", label: s.label });
    if (s.lines) treeRows(s.lines, maxLevel, 1, rows);
    rows.push({ kind: "subtotal", label: `Total ${s.label.toLowerCase()}`, values: s.values, depth: 0 });
  }
  return rows;
}

export function balanceSheetRows(bs: BalanceSheet, maxLevel: number): StatementRow[] {
  const rows: StatementRow[] = [];
  rows.push({ kind: "head", label: "Assets" });
  treeRows(bs.assets.lines, maxLevel, 1, rows);
  rows.push({ kind: "grand", label: "Total assets", values: bs.assets.total });
  rows.push({ kind: "spacer", label: "" });
  rows.push({ kind: "head", label: "Equity and liabilities" });
  rows.push({ kind: "subhead", label: "Equity", depth: 1 });
  treeRows(bs.equity.lines, maxLevel, 2, rows);
  rows.push({ kind: "line", label: "Profit for the period (not yet closed)", values: bs.equity.profit, depth: 2 });
  rows.push({ kind: "total", label: "Total equity", values: bs.equity.total });
  rows.push({ kind: "subhead", label: "Liabilities", depth: 1 });
  treeRows(bs.liabilities.lines, maxLevel, 2, rows);
  rows.push({ kind: "total", label: "Total liabilities", values: bs.liabilities.total });
  rows.push({ kind: "grand", label: "Total equity and liabilities", values: bs.total_le });
  return rows;
}

export function cashFlowStatementRows(cf: CashFlow): StatementRow[] {
  const v = (n: number) => [n];
  const rows: StatementRow[] = [];
  rows.push({ kind: "head", label: "Cash flows from operating activities" });
  rows.push({ kind: "line", label: "Profit for the period", values: v(cf.operating.net_profit), depth: 1 });
  if (Math.abs(cf.operating.depreciation) >= 0.005) rows.push({ kind: "line", label: "Add back: depreciation", values: v(cf.operating.depreciation), depth: 1 });
  if (cf.operating.working_capital.length) rows.push({ kind: "group", label: "Changes in working capital", depth: 1 });
  for (const l of cf.operating.working_capital) {
    const liability = l.code.startsWith("2");
    const what = l.amount < 0 ? (liability ? "Decrease in" : "Increase in") : (liability ? "Increase in" : "Decrease in");
    rows.push({ kind: "line", label: `${what} ${l.name.toLowerCase()}`, values: v(l.amount), depth: 2, code: l.code });
  }
  rows.push({ kind: "total", label: "Net cash from operating activities", values: v(cf.operating.total) });
  rows.push({ kind: "head", label: "Cash flows from investing activities" });
  for (const l of cf.investing.lines) rows.push({ kind: "line", label: l.amount < 0 ? `Purchase of ${l.name.toLowerCase()}` : `Sale of ${l.name.toLowerCase()}`, values: v(l.amount), depth: 1, code: l.code });
  rows.push({ kind: "total", label: "Net cash from investing activities", values: v(cf.investing.total) });
  rows.push({ kind: "head", label: "Cash flows from financing activities" });
  for (const l of cf.financing.lines) rows.push({ kind: "line", label: l.name, values: v(l.amount), depth: 1, code: l.code });
  rows.push({ kind: "total", label: "Net cash from financing activities", values: v(cf.financing.total) });
  rows.push({ kind: "grand", label: "Net increase / (decrease) in cash", values: v(cf.net_change) });
  rows.push({ kind: "line", label: "Cash and cash equivalents at the start", values: v(cf.opening_cash), depth: 0 });
  rows.push({ kind: "grand", label: "Cash and cash equivalents at the end", values: v(cf.closing_cash) });
  return rows;
}

/** Accounting number format: thousands separators, negatives in brackets, zero as a dash. */
export const fmtAmount = (v: number | undefined) => {
  const n = Number(v || 0);
  if (Math.abs(n) < 0.005) return "–";
  const s = Math.abs(n).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
};
