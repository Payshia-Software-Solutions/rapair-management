"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchAccountLedger } from "@/lib/api";
import { PrintDocument, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

const nice = (d?: string | null) => (d ? new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function AccountLedgerPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<[string, string]>(["", ""]);

  useEffect(() => {
    if (!id) return;
    const p = new URLSearchParams(window.location.search);
    const from = p.get("from") || "", to = p.get("to") || "";
    setRange([from, to]);
    fetchAccountLedger(id, { from: from || undefined, to: to || undefined })
      .then((r: any) => { setAccount(r.account); setItems(r.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  let running = 0;
  const rows = items.map(i => {
    const d = Number(i.debit || 0), c = Number(i.credit || 0);
    running += d - c;
    return {
      date: <span className="tabular-nums">{nice(i.entry_date)}</span>,
      ref: <span className="text-slate-600">{i.ref_type ? `${String(i.ref_type).replace(/([a-z])([A-Z])/g, "$1 $2")} #${i.ref_id}` : `JV-${i.entry_id}`}</span>,
      desc: <>{i.entry_desc}{i.line_notes && <div className="text-[10px] text-slate-500">{i.line_notes}</div>}</>,
      dr: fmtMoney(d), cr: fmtMoney(c), bal: fmtMoney(running, false),
    };
  });
  const totalDr = items.reduce((s, i) => s + Number(i.debit || 0), 0);
  const totalCr = items.reduce((s, i) => s + Number(i.credit || 0), 0);

  return (
    <PrintDocument
      title="Account Ledger"
      number={account?.code}
      loading={loading}
      error={!loading && !account ? "Account not found." : null}
      ready={!!account}
      meta={[["Account", account ? `${account.code} · ${account.name}` : ""], ["Period", range[0] || range[1] ? `${nice(range[0]) || "Start"} to ${nice(range[1]) || "today"}` : "All dates"]]}
      signatures={["Prepared by", "Checked by"]}
    >
      <PrintTable
        columns={[
          { key: "date", label: "Date", width: "22mm" },
          { key: "ref", label: "Reference", width: "36mm" },
          { key: "desc", label: "Description" },
          { key: "dr", label: "Debit", align: "right", width: "26mm" },
          { key: "cr", label: "Credit", align: "right", width: "26mm" },
          { key: "bal", label: "Balance", align: "right", width: "28mm" },
        ]}
        rows={rows}
        empty="No postings in this period."
      />
      <PrintTotals lines={[
        { label: "Total debits", value: fmtMoney(totalDr) },
        { label: "Total credits", value: fmtMoney(totalCr) },
        { label: "Movement for the period", value: fmtMoney(totalDr - totalCr, false), grand: true },
      ]} />
    </PrintDocument>
  );
}
