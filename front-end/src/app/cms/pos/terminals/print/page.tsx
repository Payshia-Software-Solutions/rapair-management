"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { posShiftApi, type PosTerminal } from "@/lib/api/pos-shifts";
import { PrintDocument, PrintSection, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

/** Terminal sales report: live open-shift figures and today's sales per terminal, grouped by location. */
function TerminalReport() {
  const params = useSearchParams();
  const locationId = params.get("location_id") || "all";
  const autoPrint = params.get("autoprint") !== "0";
  const [rows, setRows] = useState<PosTerminal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printedAt] = useState(() => new Date());

  useEffect(() => {
    posShiftApi.terminals(locationId).then(setRows).catch((e) => { setRows([]); setError(e.message || "Could not load terminals."); });
  }, [locationId]);

  const list = rows || [];
  const groups = new Map<string, PosTerminal[]>();
  for (const t of list) {
    const k = t.location_name || `Location ${t.location_id}`;
    groups.set(k, [...(groups.get(k) || []), t]);
  }
  const sum = (ts: PosTerminal[], f: (t: PosTerminal) => any) => ts.reduce((a, t) => a + Number(f(t) || 0), 0);

  const meta: [string, React.ReactNode][] = [
    ["Location", locationId === "all" ? "All locations" : (list[0]?.location_name || "–")],
    ["Printed", printedAt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
    ["Terminals", `${list.length} (${list.filter((t) => t.shift).length} open)`],
  ];

  return (
    <PrintDocument
      title="Terminal Sales Report"
      number={printedAt.toISOString().slice(0, 10)}
      size="A4-landscape"
      loading={rows === null}
      error={error || (rows && rows.length === 0 ? "No terminals to report." : null)}
      ready={!!rows && rows.length > 0}
      autoPrint={autoPrint}
      meta={meta}
      signatures={["Prepared by", "Checked by"]}
    >
      {[...groups.entries()].map(([loc, ts]) => (
        <PrintSection key={loc} title={loc}>
          <PrintTable
            columns={[
              { key: "name", label: "Terminal" },
              { key: "shift", label: "Open shift" },
              { key: "float", label: "Float", align: "right", width: "22mm" },
              { key: "cash", label: "Cash sales", align: "right", width: "24mm" },
              { key: "moves", label: "In / out / refunds", align: "right", width: "30mm" },
              { key: "expected", label: "Cash in drawer", align: "right", width: "26mm" },
              { key: "other", label: "Other payments", align: "right", width: "26mm" },
              { key: "shiftSales", label: "Shift sales", align: "right", width: "26mm" },
              { key: "today", label: "Today", align: "right", width: "28mm" },
            ]}
            rows={ts.map((t) => {
              const s = t.shift?.summary;
              const other = s ? Object.entries(s.methods || {}).filter(([m]) => m !== "Cash").reduce((a, [, v]) => a + Number(v.total || 0), 0) : 0;
              const net = s ? Number(s.voucher_cash || 0) + Number(s.pay_in || 0) - Number(s.pay_out || 0) - Number(s.cash_refunds || 0) : 0;
              return {
                name: <span className="font-medium">{t.name}</span>,
                shift: t.shift ? <>{t.shift.shift_no}<div className="text-[10px] text-slate-500">{t.shift.opened_by} · since {String(t.shift.opened_at).slice(11, 16)}</div></> : <span className="text-slate-500">Closed</span>,
                float: s ? fmtMoney(s.opening_float, false) : "–",
                cash: s ? fmtMoney(s.cash_sales, false) : "–",
                moves: s ? fmtMoney(net, false) : "–",
                expected: s ? <span className="font-semibold">{fmtMoney(s.expected_cash, false)}</span> : "–",
                other: s ? fmtMoney(other, false) : "–",
                shiftSales: s ? <>{fmtMoney(s.sales_total, false)}<div className="text-[10px] text-slate-500">{s.invoice_count} inv.</div></> : "–",
                today: <>{fmtMoney(t.today?.total || 0, false)}<div className="text-[10px] text-slate-500">{t.today?.count || 0} inv.</div></>,
              };
            })}
          />
          <PrintTotals lines={[
            { label: "Cash in drawers", value: fmtMoney(sum(ts, (t) => t.shift?.summary.expected_cash)) },
            { label: "Open shift sales", value: fmtMoney(sum(ts, (t) => t.shift?.summary.sales_total)) },
            { label: `Today's sales (${loc})`, value: fmtMoney(sum(ts, (t) => t.today?.total)), grand: true },
          ]} />
        </PrintSection>
      ))}

      {groups.size > 1 && (
        <PrintTotals lines={[
          { label: "All locations: cash in drawers", value: fmtMoney(sum(list, (t) => t.shift?.summary.expected_cash)) },
          { label: "All locations: today's sales", value: fmtMoney(sum(list, (t) => t.today?.total)), grand: true },
        ]} />
      )}
    </PrintDocument>
  );
}

export default function TerminalReportPrintPage() {
  return <Suspense fallback={null}><TerminalReport /></Suspense>;
}
