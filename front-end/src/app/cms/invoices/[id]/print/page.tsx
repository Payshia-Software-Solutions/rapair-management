"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchInvoiceDetails, fetchCompany, type CompanyRow } from "@/lib/api";
import { PrintDocument, PrintNotes, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";

function PrintContent() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('autoprint') === '1';
  const taxInclusive = searchParams.get('tax_inclusive') === '1';

  const [invoice, setInvoice] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [invoiceData, companyData] = await Promise.all([
          fetchInvoiceDetails(id),
          fetchCompany().catch(() => null)
        ]);
        setInvoice(invoiceData);
        setCompany(companyData);
      } catch (error) {
        console.error("Failed to load print data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  const inv = invoice;
  const balance = inv ? Number(inv.grand_total) - Number(inv.paid_amount) : 0;
  // Back-office invoice always shows base prices + full tax breakdown (like the Tax Invoice),
  // even for menu-pricing invoices. Menu prices stay on the customer receipt.
  const isMenu = false;
  const shortTax = (name: string) => {
    const u = (name || "").toUpperCase();
    if (u.includes("SOCIAL SECURITY CONTRIBUTION LEVY")) return "SSCL";
    if (u.includes("VALUE ADDED TAX")) return "VAT";
    return name;
  };
  const totalTaxPercent = (inv?.applied_taxes || []).reduce((a: number, t: any) => a + Number(t.rate_percent || 0), 0);

  const rows = (inv?.items || []).map((item: any) => {
    let price = Number(item.unit_price), disc = Number(item.discount || 0), line = Number(item.line_total);
    if (isMenu && item.display_unit_price != null) {
      price = Number(item.display_unit_price); disc = Number(item.display_discount || 0); line = Number(item.display_line_total ?? 0);
    } else if (taxInclusive && totalTaxPercent > 0) {
      const k = 1 + totalTaxPercent / 100;
      price *= k; disc *= k; line *= k;
    }
    return {
      desc: <><div className="font-medium">{item.description}</div>
        {(item.part_number || item.sku) && <div className="text-[10px] text-slate-500">Code: {item.part_number || item.sku}</div>}
        {Number(item.is_complimentary) === 1 && <div className="text-[10px] text-slate-500">Complimentary{item.comp_reason ? `: ${item.comp_reason}` : ""}</div>}</>,
      qty: item.quantity,
      price: fmtMoney(price),
      disc: disc > 0 ? `(${fmtMoney(disc)})` : "–",
      total: fmtMoney(line),
    };
  });

  const totals: { label: React.ReactNode; value: React.ReactNode; grand?: boolean; muted?: boolean }[] = [];
  if (inv) {
    if (isMenu) {
      totals.push({ label: "Subtotal", value: fmtMoney(inv.display_subtotal) });
      if (Number(inv.display_discount_total || 0) > 0) totals.push({ label: `Discount${inv.applied_promotion_name ? ` (${inv.applied_promotion_name})` : ""}`, value: `(${fmtMoney(inv.display_discount_total)})` });
      if (Number(inv.display_service_charge || 0) > 0) totals.push({ label: "Service charge", value: fmtMoney(inv.display_service_charge) });
    } else {
      totals.push({ label: "Subtotal", value: fmtMoney(inv.subtotal) });
      const taxSum = (inv.applied_taxes || []).reduce((a: number, t: any) => a + Number(t.amount || 0), 0);
      const inferred = Number(inv.subtotal) + taxSum - Number(inv.grand_total);
      const discount = Number(inv.discount_total) > 0 ? Number(inv.discount_total) : (inferred > 0.01 ? inferred : 0);
      if (discount > 0 || inv.applied_promotion_name) totals.push({ label: `Discount${inv.applied_promotion_name ? ` (${inv.applied_promotion_name})` : ""}`, value: `(${fmtMoney(discount, false)})` });
      if (inv.applied_taxes?.length) {
        for (const t of inv.applied_taxes) totals.push({ label: `${shortTax(t.tax_code || t.tax_name)}${Number(t.rate_percent) > 0 ? ` (${Number(t.rate_percent)}%)` : ""}`, value: fmtMoney(t.amount) });
      } else if (Number(inv.tax_total) > 0) totals.push({ label: "Tax", value: fmtMoney(inv.tax_total) });
      if (Number(inv.shipping_fee) > 0) totals.push({ label: `Shipping (${inv.shipping_provider_name || "Standard"})`, value: fmtMoney(inv.shipping_fee) });
    }
    totals.push({ label: "Total (LKR)", value: fmtMoney(inv.grand_total), grand: true });
    totals.push({ label: "Paid", value: fmtMoney(inv.paid_amount, false), muted: true });
    totals.push({ label: <span className="font-bold">Balance due</span>, value: <span className="font-bold">{fmtMoney(balance, false)}</span> });
  }

  const meta: [string, React.ReactNode][] = inv ? [
    ["Bill to", <><div>{inv.customer_name}</div>{inv.customer_phone && <div className="font-normal text-slate-600">{inv.customer_phone}</div>}{inv.billing_address && <div className="font-normal text-slate-600 whitespace-pre-line">{inv.billing_address}</div>}</>],
    ["Date", new Date(inv.created_at || inv.issue_date).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
    ...(inv.shipping_address && inv.shipping_address !== inv.billing_address ? [["Ship to", <span className="whitespace-pre-line">{inv.shipping_address}</span>] as [string, React.ReactNode]] : []),
    ["Due date", inv.due_date || "–"],
    ["Status", inv.status],
    ...(inv.order_id ? [["Order ref", `#${inv.order_id}`] as [string, React.ReactNode]] : []),
    ...(inv.online_order_id ? [["Web order", inv.web_order_no || inv.online_order_id] as [string, React.ReactNode]] : []),
    ...(inv.order_type === "dine_in" && inv.table_name ? [["Table", inv.table_name] as [string, React.ReactNode]] : []),
    ...(inv.order_type === "dine_in" && inv.steward_name ? [["Steward", inv.steward_name] as [string, React.ReactNode]] : []),
  ] : [];

  return (
    <PrintDocument
      title="Invoice"
      number={inv?.invoice_no}
      loading={loading}
      error={!loading && !inv ? "Invoice not found." : null}
      ready={!!inv}
      autoPrint={autoPrint}
      company={company}
      branch={inv ? { name: inv.location_name, address: inv.location_address, phone: inv.location_phone, tax_no: inv.location_tax_no } : undefined}
      meta={meta}
      signatures={["Authorized by", "Customer"]}
      footerNote={`Thank you for your business. Please make payments to "${company?.name || ""}" by the due date.`}
    >
      <PrintTable
        columns={[
          { key: "desc", label: "Description" },
          { key: "qty", label: "Qty", align: "right", width: "14mm" },
          { key: "price", label: "Unit price", align: "right", width: "26mm" },
          { key: "disc", label: "Discount", align: "right", width: "24mm" },
          { key: "total", label: "Amount", align: "right", width: "28mm" },
        ]}
        rows={rows}
      />
      <PrintTotals lines={totals} />
      {inv?.notes ? <PrintNotes label="Notes and terms">{inv.notes}</PrintNotes> : null}
    </PrintDocument>
  );
}

export default function InvoicePrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintContent />
    </Suspense>
  );
}
