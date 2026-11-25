"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchJournalEntries, fetchJournalItems } from "@/lib/api";
import { PrintDocument, PrintTable, fmtMoney } from "@/components/print/PrintDocument";

function JournalVoucher() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const [entry, setEntry] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [entries, lines] = await Promise.all([fetchJournalEntries({ id }), fetchJournalItems(id)]);
        // The list endpoint answers { status, data: [...] }
        const list = Array.isArray(entries) ? entries : (entries?.data || []);
        setEntry(list[0] || null);
        setItems(lines || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const totalDebit = items.reduce((s, i) => s + Number(i.debit || 0), 0);
  const totalCredit = items.reduce((s, i) => s + Number(i.credit || 0), 0);
  const date = entry ? new Date(String(entry.entry_date) + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const reference = entry?.ref_type ? `${String(entry.ref_type).replace(/([a-z])([A-Z])/g, "$1 $2")} #${entry.ref_id}` : "Manual entry";

  return (
    <PrintDocument
      title="Journal Voucher"
      number={entry ? `JV-${entry.id}` : undefined}
      loading={loading}
      error={!loading && !entry ? "Journal entry not found." : null}
      ready={!!entry}
      autoPrint={sp.get("autoprint") !== "0"}
      meta={entry ? [["Date", date], ["Reference", reference], ["Description", entry.description || "–"]] : []}
    >
      <PrintTable
        columns={[
          { key: "code", label: "Code", width: "22mm" },
          { key: "account", label: "Account" },
          { key: "notes", label: "Notes" },
          { key: "debit", label: "Debit (LKR)", align: "right", width: "30mm" },
          { key: "credit", label: "Credit (LKR)", align: "right", width: "30mm" },
        ]}
        rows={items.map(i => ({
          code: <span className="text-slate-600 tabular-nums">{i.account_code}</span>,
          account: <span className="font-medium">{i.account_name}</span>,
          notes: <span className="text-slate-600">{i.notes || ""}</span>,
          debit: fmtMoney(i.debit),
          credit: fmtMoney(i.credit),
        }))}
      />
      <table className="w-full">
        <tbody>
          <tr className="font-bold">
            <td className="py-1.5 px-1.5 text-right">Total</td>
            <td className="py-1.5 px-1.5 text-right tabular-nums w-[30mm] border-b-[3px] border-double border-slate-900">{fmtMoney(totalDebit)}</td>
            <td className="py-1.5 px-1.5 text-right tabular-nums w-[30mm] border-b-[3px] border-double border-slate-900">{fmtMoney(totalCredit)}</td>
          </tr>
        </tbody>
      </table>
    </PrintDocument>
  );
}

export default function JournalPrintPage() {
  return (
    <Suspense fallback={null}>
      <JournalVoucher />
    </Suspense>
  );
}
