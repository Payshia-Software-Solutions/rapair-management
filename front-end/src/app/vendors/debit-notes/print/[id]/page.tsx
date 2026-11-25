"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { debitNoteApi, type DebitNote } from "@/lib/api/debit-notes";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

export default function DebitNotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<DebitNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    debitNoteApi.details(id).then(setNote).catch((e) => setError(e.message || "Debit note not found.")).finally(() => setLoading(false));
  }, [id]);

  const n = note;
  return (
    <PrintDocument
      title="Debit Note"
      number={n?.dn_no}
      loading={loading}
      error={error || (!loading && !n ? "Debit note not found." : null)}
      ready={!!n}
      meta={n ? [
        ["To supplier", n.supplier_name],
        ["Date", new Date(n.dn_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
        ["Against GRN", n.grn_number || "–"],
        ["Your credit note", n.supplier_ref || "–"],
        ["Reason", n.reason],
        ...(n.status === "Cancelled" ? [["Status", `Cancelled${n.cancel_reason ? `: ${n.cancel_reason}` : ""}`] as [string, React.ReactNode]] : []),
      ] : []}
      signatures={["Prepared by", "Authorized by", "Supplier acknowledgement"]}
      footerNote="Please issue your credit note for the amount above, or adjust it against our next payment."
    >
      <PrintTable
        columns={[{ key: "desc", label: "Description" }, { key: "amt", label: "Amount (LKR)", align: "right", width: "34mm" }]}
        rows={(n?.items || []).map(i => ({ desc: i.description, amt: fmtMoney(i.amount) }))}
      />
      <PrintTotals lines={[
        { label: "Subtotal", value: fmtMoney(n?.subtotal) },
        ...(Number(n?.tax_amount) > 0 ? [{ label: "Tax", value: fmtMoney(n?.tax_amount) }] : []),
        { label: "Total claimed", value: fmtMoney(n?.total), grand: true },
      ]} />
      {n?.notes ? <PrintNotes>{n.notes}</PrintNotes> : null}
    </PrintDocument>
  );
}
