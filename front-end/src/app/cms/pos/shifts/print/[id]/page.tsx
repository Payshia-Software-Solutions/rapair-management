"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { posShiftApi, type PosShift } from "@/lib/api/pos-shifts";
import { PrintDocument, PrintNotes, PrintSection, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

function ShiftPrint() {
  const { id } = useParams() as { id: string };
  const autoPrint = useSearchParams().get("autoprint") !== "0";
  const [s, setS] = useState<PosShift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    posShiftApi.details(id).then(setS).catch(() => setS(null)).finally(() => setLoading(false));
  }, [id]);

  const sum = s?.summary || s?.summary_live;
  const closed = s?.status === "Closed";
  const variance = Number(s?.variance || 0);

  const meta: [string, React.ReactNode][] = s ? [
    ["Opened by", s.user_name || "–"],
    ["Location", s.location_name || "–"],
    ["Terminal", s.terminal_name || "–"],
    ["Opened", s.opened_at],
    ["Closed", s.closed_at || "Still open"],
    ["Status", s.status],
  ] : [];

  const cashLines = sum ? ([
    ["Opening cash", sum.opening_float],
    ["Cash sales", sum.cash_sales],
    ["Gift vouchers sold (cash)", sum.voucher_cash],
    ["Pay ins", sum.pay_in],
    ["Pay outs", -Number(sum.pay_out || 0)],
    ["Cash refunds", -Number(sum.cash_refunds || 0)],
  ] as [string, any][]).filter(([l, v]) => Number(v) !== 0 || l === "Opening cash" || l === "Cash sales") : [];

  const totals: { label: React.ReactNode; value: React.ReactNode; grand?: boolean; muted?: boolean }[] = [];
  if (sum) {
    totals.push({ label: "Expected cash", value: fmtMoney(sum.expected_cash), grand: !closed });
    if (s?.counted_cash != null) totals.push({ label: "Counted cash", value: fmtMoney(s.counted_cash), grand: true });
    if (closed) totals.push({
      label: <span className="font-bold">{variance === 0 ? "Difference (balanced)" : variance > 0 ? "Difference (over)" : "Difference (short)"}</span>,
      value: <span className="font-bold">{fmtMoney(variance, false)}</span>,
    });
  }

  return (
    <PrintDocument
      title="Shift Summary"
      number={s?.shift_no}
      loading={loading}
      error={!loading && !s ? "Shift not found." : null}
      ready={!!s}
      autoPrint={autoPrint}
      meta={meta}
      signatures={["Cashier", "Supervisor"]}
    >
      <PrintSection title="Cash drawer">
        <PrintTable
          columns={[{ key: "l", label: "Item" }, { key: "v", label: "Amount (LKR)", align: "right", width: "40mm" }]}
          rows={cashLines.map(([l, v]) => ({ l, v: fmtMoney(v, false) }))}
        />
        <PrintTotals lines={totals} />
      </PrintSection>

      {sum && (
        <PrintSection title="Payments taken">
          <PrintTable
            columns={[{ key: "m", label: "Method" }, { key: "c", label: "Count", align: "right", width: "20mm" }, { key: "t", label: "Amount (LKR)", align: "right", width: "40mm" }]}
            rows={[
              ...Object.entries(sum.methods || {}).map(([m, v]) => ({ m, c: v.count, t: fmtMoney(v.total, false) })),
              { m: <span className="font-semibold">Invoices</span>, c: sum.invoice_count, t: <span className="font-semibold">{fmtMoney(sum.sales_total, false)}</span> },
            ]}
          />
        </PrintSection>
      )}

      {sum && (sum.moves || []).length > 0 && (
        <PrintSection title="Pay ins and outs">
          <PrintTable
            columns={[{ key: "d", label: "Time", width: "40mm" }, { key: "t", label: "Type", width: "20mm" }, { key: "r", label: "Reason" }, { key: "a", label: "Amount (LKR)", align: "right", width: "36mm" }]}
            rows={sum.moves.map(m => ({ d: m.created_at, t: m.type === "PayIn" ? "In" : "Out", r: m.reason, a: fmtMoney(m.type === "PayIn" ? m.amount : -Number(m.amount), false) }))}
          />
        </PrintSection>
      )}

      {s?.denominations && Object.keys(s.denominations).length > 0 && (
        <PrintSection title="Cash count">
          <PrintTable
            columns={[{ key: "d", label: "Note / coin", align: "right", width: "30mm" }, { key: "n", label: "Qty", align: "right", width: "20mm" }, { key: "t", label: "Amount (LKR)", align: "right" }]}
            rows={Object.entries(s.denominations).sort((a, b) => Number(b[0]) - Number(a[0])).map(([d, n]) => ({ d: Number(d).toLocaleString(), n, t: fmtMoney(Number(d) * Number(n), false) }))}
          />
        </PrintSection>
      )}

      {s?.close_notes ? <PrintNotes label="Closing note">{s.close_notes}</PrintNotes> : null}
    </PrintDocument>
  );
}

export default function ShiftPrintPage() {
  return <Suspense fallback={null}><ShiftPrint /></Suspense>;
}
