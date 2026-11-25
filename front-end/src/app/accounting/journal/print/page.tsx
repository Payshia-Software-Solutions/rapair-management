"use client";

import React, { useEffect, useState } from "react";
import { fetchJournalEntries } from "@/lib/api";
import { PrintDocument, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

const nice = (d: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function JournalRegisterPrintPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<[string, string]>(["", ""]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const from = p.get("from") || "", to = p.get("to") || "";
    setRange([from, to]);
    fetchJournalEntries({ from, to, limit: 500 })
      .then((r: any) => setEntries(Array.isArray(r) ? r : r?.data || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const total = entries.reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const period = range[0] || range[1] ? `${nice(range[0]) || "Start"} to ${nice(range[1]) || "today"}` : "All dates";

  return (
    <PrintDocument title="Journal Register" loading={loading} ready={!loading} meta={[["Period", period], ["Entries", String(entries.length)]]} signatures={["Prepared by", "Checked by"]}>
      <PrintTable
        columns={[
          { key: "id", label: "No.", width: "18mm" },
          { key: "date", label: "Date", width: "24mm" },
          { key: "desc", label: "Description" },
          { key: "ref", label: "Reference", width: "40mm" },
          { key: "amt", label: "Amount (LKR)", align: "right", width: "32mm" },
        ]}
        rows={entries.map(e => ({
          id: <span className="tabular-nums text-slate-600">JV-{e.id}</span>,
          date: <span className="tabular-nums">{nice(String(e.entry_date).slice(0, 10))}</span>,
          desc: e.description,
          ref: e.ref_type ? `${String(e.ref_type).replace(/([a-z])([A-Z])/g, "$1 $2")} #${e.ref_id}` : "Manual",
          amt: fmtMoney(e.total_amount),
        }))}
        empty="No journal entries in this period."
      />
      <PrintTotals lines={[{ label: "Total", value: fmtMoney(total), grand: true }]} />
    </PrintDocument>
  );
}
