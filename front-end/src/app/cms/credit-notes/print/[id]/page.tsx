"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { creditNoteApi, type CreditNote } from "@/lib/api/credit-notes";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

export default function CreditNotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<CreditNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    creditNoteApi.details(id).then(setNote).catch((e) => setError(e.message || "Credit note not found.")).finally(() => setLoading(false));
  }, [id]);

  const n = note;
  return (
    <PrintDocument
      title="Credit Note"
      number={n?.cn_no}
      loading={loading}
      error={error || (!loading && !n ? "Credit note not found." : null)}
      ready={!!n}
      meta={n ? [
        ["Customer", <><div>{n.customer_name}</div>{n.customer_phone && <div className="font-normal text-slate-600">{n.customer_phone}</div>}</>],
        ["Date", new Date(n.cn_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
        ["Against invoice", n.invoice_no || "–"],
        ["Reason", n.reason],
        ...(n.status === "Cancelled" ? [["Status", `Cancelled${n.cancel_reason ? `: ${n.cancel_reason}` : ""}`] as [string, React.ReactNode]] : []),
      ] : []}
      signatures={["Prepared by", "Authorized by", "Customer"]}
    >
      <PrintTable
        columns={[{ key: "desc", label: "Description" }, { key: "amt", label: "Amount (LKR)", align: "right", width: "34mm" }]}
        rows={(n?.items || []).map(i => ({ desc: i.description, amt: fmtMoney(i.amount) }))}
      />
      <PrintTotals lines={[
        { label: "Subtotal", value: fmtMoney(n?.subtotal) },
        ...(Number(n?.tax_amount) > 0 ? [{ label: "Tax", value: fmtMoney(n?.tax_amount) }] : []),
        { label: "Total credit", value: fmtMoney(n?.total), grand: true },
        ...(n && n.status !== "Cancelled" && (Number(n.applied_amount) > 0 || Number(n.refunded_amount) > 0) ? [
          { label: "Applied to invoices", value: fmtMoney(n.applied_amount), muted: true },
          { label: "Refunded", value: fmtMoney(n.refunded_amount), muted: true },
          { label: "Credit remaining", value: fmtMoney(n.remaining, false) },
        ] : []),
      ]} />
      {n?.notes ? <PrintNotes>{n.notes}</PrintNotes> : null}
    </PrintDocument>
  );
}
