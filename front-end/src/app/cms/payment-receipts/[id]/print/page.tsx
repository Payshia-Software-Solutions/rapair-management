"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchPaymentReceiptDetails, fetchCompany, type CompanyRow } from "@/lib/api";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

function PrintContent() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoprint") === "1";

  const [receipt, setReceipt] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [r, c] = await Promise.all([fetchPaymentReceiptDetails(id), fetchCompany().catch(() => null)]);
        setReceipt(r);
        setCompany(c);
      } catch (e) {
        console.error("Failed to load print data", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const r = receipt;
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "–");

  const meta: [string, React.ReactNode][] = r ? [
    ["Received from", <><div>{r.customer_name}</div>{r.customer_phone && <div className="font-normal text-slate-600">{r.customer_phone}</div>}</>],
    ["Date", fmtDate(r.payment_date)],
    ["Invoice no", r.invoice_no || "–"],
    ["Payment method", r.payment_method],
    ...(r.location_name ? [["Location", r.location_name] as [string, React.ReactNode]] : []),
  ] : [];

  // Method-specific details
  const details: { k: string; v: React.ReactNode }[] = [];
  if (r?.payment_method === "Card") {
    if (r.card_type) details.push({ k: "Card type", v: r.card_type });
    if (r.card_last4) details.push({ k: "Card no", v: `**** ${r.card_last4}` });
    if (r.card_auth_code) details.push({ k: "Auth code", v: r.card_auth_code });
    if (r.card_bank_name) details.push({ k: "Bank", v: r.card_bank_name });
  } else if (r?.payment_method === "Cheque") {
    if (r.cheque_no_last6) details.push({ k: "Cheque no", v: `#${r.cheque_no_last6}` });
    if (r.cheque_bank_name) details.push({ k: "Bank", v: r.cheque_bank_name });
    details.push({ k: "Cheque date", v: fmtDate(r.cheque_date) });
  }

  return (
    <PrintDocument
      title="Payment Receipt"
      number={r?.receipt_no}
      loading={loading}
      error={!loading && !r ? "Receipt not found." : null}
      ready={!!r}
      autoPrint={autoPrint}
      company={company}
      meta={meta}
      signatures={["Received by", "Customer"]}
      footerNote="Thank you for your payment."
    >
      <PrintTable
        columns={[
          { key: "desc", label: "Description" },
          { key: "method", label: "Method", width: "30mm" },
          { key: "amount", label: "Amount", align: "right", width: "32mm" },
        ]}
        rows={r ? [{
          desc: <div className="font-medium">Payment against invoice {r.invoice_no}</div>,
          method: r.payment_method,
          amount: fmtMoney(r.amount),
        }] : []}
      />
      <PrintTotals lines={r ? [{ label: "Total received (LKR)", value: fmtMoney(r.amount), grand: true }] : []} />
      {details.length > 0 && (
        <PrintNotes label={`${r.payment_method} details`}>
          {details.map(d => <div key={d.k}>{d.k}: {d.v}</div>)}
        </PrintNotes>
      )}
      {r?.notes ? <PrintNotes label="Notes">{r.notes}</PrintNotes> : null}
    </PrintDocument>
  );
}

export default function ReceiptPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintContent />
    </Suspense>
  );
}
