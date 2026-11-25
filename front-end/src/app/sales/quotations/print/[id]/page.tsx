"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchQuotationDetails, fetchCompany, type CompanyRow } from "@/lib/api";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

function PrintContent() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('autoprint') === '1';

  const [quotation, setQuotation] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [quotationData, companyData] = await Promise.all([
          fetchQuotationDetails(id),
          fetchCompany().catch(() => null)
        ]);
        setQuotation(quotationData);
        setCompany(companyData);
      } catch (error) {
        console.error("Failed to load print data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  const q = quotation;
  const d = (v: any) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–");
  const taxLines = q?.taxes?.length
    ? q.taxes.map((t: any) => ({ label: `${t.tax_code || t.tax_name}${Number(t.rate_percent) > 0 ? ` (${Number(t.rate_percent)}%)` : ""}`, value: fmtMoney(t.amount) }))
    : Number(q?.tax_total) > 0 ? [{ label: "Tax", value: fmtMoney(q.tax_total) }] : [];

  return (
    <PrintDocument
      title="Quotation"
      number={q?.quotation_no}
      loading={loading}
      error={!loading && !q ? "Quotation not found." : null}
      ready={!!q}
      autoPrint={autoPrint}
      company={company}
      branch={q ? { name: q.location_name, address: q.location_address, phone: q.location_phone, tax_no: q.location_tax_no } : undefined}
      meta={q ? [
        ["Customer", <><div>{q.customer_name}</div>{q.customer_phone && <div className="font-normal text-slate-600">{q.customer_phone}</div>}{q.customer_address && <div className="font-normal text-slate-600 whitespace-pre-line">{q.customer_address}</div>}</>],
        ["Issue date", d(q.issue_date)],
        ["Valid until", d(q.expiry_date)],
        ["Status", q.status],
      ] : []}
      signatures={["Prepared by", "Customer acceptance"]}
      footerNote="Prices are valid until the date shown above."
    >
      <PrintTable
        columns={[
          { key: "desc", label: "Description" },
          { key: "qty", label: "Qty", align: "right", width: "16mm" },
          { key: "price", label: "Unit price", align: "right", width: "28mm" },
          { key: "total", label: "Amount", align: "right", width: "30mm" },
        ]}
        rows={(q?.items || []).map((it: any) => ({
          desc: <><div className="font-medium">{it.description}</div>{it.item_type && <div className="text-[10px] text-slate-500">{it.item_type}</div>}</>,
          qty: it.quantity,
          price: fmtMoney(it.unit_price),
          total: fmtMoney(it.line_total),
        }))}
      />
      <PrintTotals lines={[
        { label: "Subtotal", value: fmtMoney(q?.subtotal) },
        ...(Number(q?.discount_total) > 0 ? [{ label: "Discount", value: `(${fmtMoney(q.discount_total)})` }] : []),
        ...taxLines,
        { label: "Total (LKR)", value: fmtMoney(q?.grand_total), grand: true },
      ]} />
      {q?.notes ? <PrintNotes label="Terms and conditions">{q.notes}</PrintNotes> : null}
    </PrintDocument>
  );
}

export default function QuotationPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintContent />
    </Suspense>
  );
}
