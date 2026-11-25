"use client";

import React, { useEffect, useState } from "react";
import { fetchAccounts } from "@/lib/api";
import { PrintDocument, PrintTable, fmtMoney } from "@/components/print/PrintDocument";

export default function TrialBalancePrintPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState("");

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("asOf") || new Date().toISOString().slice(0, 10);
    setAsOf(d);
    fetchAccounts({ asOf: d }).then(a => setAccounts(a || [])).catch(() => setAccounts([])).finally(() => setLoading(false));
  }, []);

  const lines = accounts.filter(a => Math.abs(Number(a.balance) || 0) >= 0.005);
  const dr = lines.reduce((s, a) => s + Math.max(0, Number(a.balance) || 0), 0);
  const cr = lines.reduce((s, a) => s + Math.max(0, -(Number(a.balance) || 0)), 0);
  const nice = asOf ? new Date(asOf + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <PrintDocument title="Trial Balance" loading={loading} ready={!loading} meta={[["As at", nice], ["Currency", "LKR"]]}
      footerNote={Math.abs(dr - cr) < 0.01 ? "Debits equal credits." : `Out of balance by ${fmtMoney(dr - cr)}. Run the Posting Check.`}>
      <PrintTable
        columns={[
          { key: "code", label: "Code", width: "24mm" },
          { key: "name", label: "Account" },
          { key: "dr", label: "Debit", align: "right", width: "34mm" },
          { key: "cr", label: "Credit", align: "right", width: "34mm" },
        ]}
        rows={lines.map(a => {
          const b = Number(a.balance) || 0;
          return { code: <span className="tabular-nums text-slate-600">{a.code}</span>, name: a.name, dr: b > 0 ? fmtMoney(b) : "–", cr: b < 0 ? fmtMoney(-b) : "–" };
        })}
        empty="No balances on this date."
      />
      <table className="w-full">
        <tbody>
          <tr className="font-bold">
            <td className="py-1.5 px-1.5 text-right">Total</td>
            <td className="py-1.5 px-1.5 text-right tabular-nums w-[34mm] border-b-[3px] border-double border-slate-900">{fmtMoney(dr)}</td>
            <td className="py-1.5 px-1.5 text-right tabular-nums w-[34mm] border-b-[3px] border-double border-slate-900">{fmtMoney(cr)}</td>
          </tr>
        </tbody>
      </table>
    </PrintDocument>
  );
}
