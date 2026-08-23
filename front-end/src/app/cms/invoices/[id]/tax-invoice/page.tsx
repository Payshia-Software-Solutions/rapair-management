"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { fetchInvoiceDetails, fetchCompany, contentUrl, type CompanyRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, X, ArrowLeft } from "lucide-react";
import { numberToWordsLKR } from "@/lib/numberToWords";

function TaxInvoiceContent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoprint") === "1";

  const [invoice, setInvoice] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [invoiceData, companyData] = await Promise.all([
          fetchInvoiceDetails(id),
          fetchCompany().catch(() => null),
        ]);
        setInvoice(invoiceData);
        setCompany(companyData);
      } catch (error) {
        console.error("Failed to load tax invoice data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (autoPrint && !loading && invoice && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loading, invoice]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium tracking-tight">Preparing Official Tax Invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <p className="text-rose-500 font-bold">Error: Invoice Not Found</p>
          <Button variant="outline" onClick={() => window.close()}>Close Window</Button>
        </div>
      </div>
    );
  }

  // Format date strictly as MM/DD/YYYY as required by Gazette 2481/22
  const formatDateMMDDYYYY = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const formatNumber = (amount: number | string | null | undefined) => {
    const n = Number(amount || 0);
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Supplier Details
  const supplierTIN = company?.tax_no || invoice.location_tax_no || "-";
  const supplierName = company?.name || invoice.location_name || "Company Name";
  const supplierAddress = invoice.location_address || company?.address || "Address of Supplier";
  const supplierPhone = invoice.location_phone || company?.phone || "";

  // Purchaser Details
  const purchaserTIN = invoice.customer_tax_no || invoice.tax_number || invoice.purchaser_tin || "-";
  const purchaserName = invoice.customer_name || "Valued Customer";
  const purchaserAddress = invoice.customer_address || (invoice.billing_address && invoice.billing_address !== supplierAddress && invoice.billing_address !== company?.address ? invoice.billing_address : "") || invoice.customer_address || "-";
  const purchaserPhone = invoice.customer_phone || "";

  // Dates
  const dateOfInvoice = formatDateMMDDYYYY(invoice.issue_date || invoice.created_at);
  const dateOfSupply = formatDateMMDDYYYY(invoice.date_of_supply || invoice.issue_date || invoice.created_at);
  const placeOfSupply = invoice.place_of_supply || invoice.location_name || "";

  // Calculation of Values
  const subtotalNet = Number(invoice.subtotal || 0);
  const discountTotal = Number(invoice.discount_total || 0);
  const shippingFee = Number(invoice.shipping_fee || 0);
  const totalValueOfSupply = Math.max(0, subtotalNet - discountTotal + shippingFee);

  // Taxes breakdown (VAT, SSCL, Service Charge, etc.)
  const appliedTaxes = invoice.applied_taxes || [];
  
  const serviceChargeTax = appliedTaxes.find((t: any) =>
    (t.tax_name || t.tax_code || "").toUpperCase().includes("SERVICE")
  );

  const ssclTax = appliedTaxes.find((t: any) =>
    (t.tax_name || t.tax_code || "").toUpperCase().includes("SSCL") ||
    (t.tax_name || t.tax_code || "").toUpperCase().includes("SOCIAL SECURITY")
  );

  const vatTax = appliedTaxes.find((t: any) =>
    (t.tax_name || t.tax_code || "").toUpperCase().includes("VAT") ||
    (t.tax_name || t.tax_code || "").toUpperCase().includes("VALUE ADDED")
  );

  const otherTaxes = appliedTaxes.filter((t: any) => t !== serviceChargeTax && t !== ssclTax && t !== vatTax);

  const serviceChargeAmount = serviceChargeTax ? Number(serviceChargeTax.amount || 0) : 0;
  const serviceChargeRate = serviceChargeTax ? Number(serviceChargeTax.rate_percent || 10) : 10;

  const ssclAmount = ssclTax ? Number(ssclTax.amount || 0) : 0;
  const ssclRate = ssclTax ? Number(ssclTax.rate_percent || 2.5) : 2.5;

  const vatRate = vatTax ? Number(vatTax.rate_percent || 0) : (appliedTaxes.length > 0 ? Number(appliedTaxes[0].rate_percent || 0) : 18);
  const vatAmount = vatTax 
    ? Number(vatTax.amount || 0) 
    : (appliedTaxes.length > 0 && !ssclTax && !serviceChargeTax
        ? appliedTaxes.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
        : (vatTax ? Number(vatTax.amount || 0) : Number(invoice.tax_total || 0) - ssclAmount - serviceChargeAmount));

  const totalTaxes = appliedTaxes.length > 0
    ? appliedTaxes.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
    : Number(invoice.tax_total || 0);

  const totalAmountWithVAT = totalValueOfSupply + totalTaxes;

  // Payments / Mode of payment
  const payments = invoice.payments || [];
  const paymentModes = payments.map((p: any) => p.payment_method).filter(Boolean);
  const uniqueModes = Array.from(new Set(paymentModes));
  const modeOfPayment = uniqueModes.length > 0 ? uniqueModes.join(", ") : (invoice.payment_method || "Bank Transfer / Cash");

  const amountInWords = numberToWordsLKR(totalAmountWithVAT);

  return (
    <div className="min-h-screen bg-slate-100/60 print:bg-white text-black text-sm">
      {/* 1. Control Bar (Hidden on Print) */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 print:hidden px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block leading-tight">Tax Invoice (Gazette No. 2481/22)</span>
              <span className="text-slate-500 text-xs font-mono">{invoice.invoice_no}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/cms/invoices/${id}/view`)}
              className="text-slate-600"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.close()}
              className="text-slate-500 hover:text-slate-900"
            >
              <X className="w-4 h-4 mr-1.5" /> Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-primary hover:bg-primary/90 text-white shadow-sm font-semibold"
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print Tax Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Official Gazette Specimen Paper Layout */}
      <div className="py-6 print:py-0">
        <div className="mx-auto w-[210mm] min-h-[297mm] bg-white shadow-xl print:shadow-none print:w-full print:border-none p-10 font-sans border border-slate-300">
          
          {/* Top Title Box */}
          <div className="flex justify-center mb-6">
            <div className="border border-black px-8 py-1.5 inline-block text-center">
              <h1 className="text-xl font-bold uppercase tracking-wider text-black">TAX INVOICE</h1>
            </div>
          </div>

          {/* Top 2 Columns Box (Supplier & Purchaser Details) */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Supplier Details Box (Top Left) */}
            <div className="border border-black p-3 flex flex-col justify-between space-y-2 min-h-[140px]">
              <div className="space-y-1">
                <div className="flex">
                  <span className="font-semibold w-36">Date of Invoice:</span>
                  <span className="font-bold">{dateOfInvoice}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-36">Supplier's TIN :</span>
                  <span className="font-bold">{supplierTIN}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-36">Supplier's Name :</span>
                  <span className="font-bold">{supplierName}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-36">Address :</span>
                  <span className="whitespace-pre-line leading-tight flex-1">{supplierAddress}</span>
                </div>
              </div>
              <div className="flex pt-1">
                <span className="font-semibold w-36">Telephone No.:*</span>
                <span>{supplierPhone || "-"}</span>
              </div>
            </div>

            {/* Purchaser Details Box (Top Right) */}
            <div className="border border-black p-3 flex flex-col justify-between space-y-2 min-h-[140px]">
              <div className="space-y-1">
                <div className="flex">
                  <span className="font-semibold w-36">Tax Invoice No. :</span>
                  <span className="font-bold">{invoice.tax_invoice_no || invoice.invoice_no}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-36">Purchaser's TIN :</span>
                  <span className="font-bold">{purchaserTIN}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-36">Purchaser's Name :</span>
                  <span className="font-bold">{purchaserName}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-36">Address :</span>
                  <span className="whitespace-pre-line leading-tight flex-1">{purchaserAddress}</span>
                </div>
              </div>
              <div className="flex pt-1">
                <span className="font-semibold w-36">Telephone No.:*</span>
                <span>{purchaserPhone || "-"}</span>
              </div>
            </div>

          </div>

          {/* Middle Row: Date of Supply & Place of Supply */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="border border-black px-3 py-1.5 flex items-center">
              <span className="font-semibold w-36">Date of Supply :</span>
              <span className="font-bold">{dateOfSupply}</span>
            </div>
            <div className="border border-black px-3 py-1.5 flex items-center">
              <span className="font-semibold w-36">Place of Supply :*</span>
              <span>{placeOfSupply || supplierAddress || "-"}</span>
            </div>
          </div>

          {/* Additional Information Box */}
          <div className="border border-black px-3 py-1.5 mt-2">
            <div className="flex">
              <span className="font-semibold w-48">Additional Information if any:*</span>
              <span className="flex-1">{invoice.notes || (invoice.order_id ? `Order #${invoice.order_id}` : "-")}</span>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mt-4 border-t border-l border-r border-black">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black text-center text-xs font-bold">
                  <th className="border-r border-black p-2 w-24 text-center">Reference*</th>
                  <th className="border-r border-black p-2 text-left">Description of Goods or Services</th>
                  <th className="border-r border-black p-2 w-20 text-center">Quantity</th>
                  <th className="border-r border-black p-2 w-28 text-right">Unit Price (Rs.)</th>
                  <th className="p-2 w-36 text-right">Amount Excluding VAT (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item: any, idx: number) => {
                  const unitPrice = Number(item.unit_price || 0);
                  const lineTotal = Number(item.line_total || (unitPrice * Number(item.quantity || 1)));
                  return (
                    <tr key={item.id || idx} className="border-b border-black text-xs">
                      <td className="border-r border-black p-2 text-center text-slate-700 font-medium">
                        {idx + 1}
                      </td>
                      <td className="border-r border-black p-2">
                        <div className="font-semibold">{item.description}</div>
                        <div className="text-[10px] text-slate-600 flex items-center gap-2 mt-0.5">
                          {item.sku && <span>SKU: {item.sku}</span>}
                          {item.part_number && item.part_number !== item.sku && <span>Code: {item.part_number}</span>}
                          {item.item_type && (
                            <span className="text-[9px] text-slate-500 uppercase">{item.item_type}</span>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-black p-2 text-center">{item.quantity}</td>
                      <td className="border-r border-black p-2 text-right">{formatNumber(unitPrice)}</td>
                      <td className="p-2 text-right font-medium">{formatNumber(lineTotal)}</td>
                    </tr>
                  );
                })}

                {/* Optional Shipping / Delivery Service Line */}
                {shippingFee > 0 && (
                  <tr className="border-b border-black text-xs">
                    <td className="border-r border-black p-2 text-center text-slate-700 font-medium">
                      {(invoice.items?.length || 0) + 1}
                    </td>
                    <td className="border-r border-black p-2">
                      <div className="font-semibold">
                        Delivery & Shipping Service {invoice.shipping_provider_name ? `(${invoice.shipping_provider_name})` : ''}
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase">SERVICE</span>
                    </td>
                    <td className="border-r border-black p-2 text-center">1.00</td>
                    <td className="border-r border-black p-2 text-right">{formatNumber(shippingFee)}</td>
                    <td className="p-2 text-right font-medium">{formatNumber(shippingFee)}</td>
                  </tr>
                )}

                {/* Discount if applicable */}
                {discountTotal > 0 && (
                  <tr className="border-b border-black text-xs font-semibold text-rose-700">
                    <td colSpan={4} className="border-r border-black p-2 text-left">
                      Discount {invoice.applied_promotion_name ? `(${invoice.applied_promotion_name})` : ''}:
                    </td>
                    <td className="p-2 text-right font-bold">-{formatNumber(discountTotal)}</td>
                  </tr>
                )}

                {/* Subtotal / Value of Supply */}
                <tr className="border-b border-black text-xs font-semibold">
                  <td colSpan={4} className="border-r border-black p-2 text-left">
                    Total Value of Supply:
                  </td>
                  <td className="p-2 text-right font-bold">{formatNumber(totalValueOfSupply)}</td>
                </tr>

                {/* Service Charge if applicable */}
                {serviceChargeAmount > 0 && (
                  <tr className="border-b border-black text-xs font-semibold">
                    <td colSpan={4} className="border-r border-black p-2 text-left">
                      Service Charge ({serviceChargeRate}%):
                    </td>
                    <td className="p-2 text-right font-bold">{formatNumber(serviceChargeAmount)}</td>
                  </tr>
                )}

                {/* SSCL Amount if applicable */}
                {ssclAmount > 0 && (
                  <tr className="border-b border-black text-xs font-semibold">
                    <td colSpan={4} className="border-r border-black p-2 text-left">
                      SSCL Amount (Total Value of Supply @ {ssclRate}%):
                    </td>
                    <td className="p-2 text-right font-bold">{formatNumber(ssclAmount)}</td>
                  </tr>
                )}

                {/* VAT Amount */}
                <tr className="border-b border-black text-xs font-semibold">
                  <td colSpan={4} className="border-r border-black p-2 text-left">
                    VAT Amount (Total Value of Supply @ {vatRate}%):
                  </td>
                  <td className="p-2 text-right font-bold">{formatNumber(vatAmount)}</td>
                </tr>

                {/* Other applied taxes if any */}
                {otherTaxes.map((tax: any, i: number) => (
                  <tr key={`other-tax-${i}`} className="border-b border-black text-xs font-semibold">
                    <td colSpan={4} className="border-r border-black p-2 text-left">
                      {tax.tax_name || tax.tax_code} {Number(tax.rate_percent) > 0 ? `(${Number(tax.rate_percent)}%)` : ''}:
                    </td>
                    <td className="p-2 text-right font-bold">{formatNumber(tax.amount)}</td>
                  </tr>
                ))}

                {/* Total Consideration including VAT */}
                <tr className="border-b border-black text-xs font-bold bg-slate-50/50 print:bg-transparent">
                  <td colSpan={4} className="border-r border-black p-2 text-left uppercase">
                    Total Amount/consideration including VAT:
                  </td>
                  <td className="p-2 text-right text-sm font-black">{formatNumber(totalAmountWithVAT)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bottom Boxes */}
          <div className="border-l border-r border-b border-black p-3 space-y-2 mt-0">
            <div className="flex">
              <span className="font-semibold w-44">Total Amount in words:*</span>
              <span className="font-bold flex-1 italic">{amountInWords}</span>
            </div>
          </div>

          <div className="border-l border-r border-b border-black p-3 mt-0">
            <div className="flex">
              <span className="font-semibold w-44">Mode of Payment:*</span>
              <span className="font-bold">{modeOfPayment}</span>
            </div>
          </div>

          {/* Footer Gazette Reference Note */}
          <div className="mt-8 text-center text-[10px] text-slate-500 print:text-black">
            <p>Issued pursuant to Section 20 of Value Added Tax Act, No. 14 of 2002 (Gazette Extraordinary No. 2481/22)</p>
          </div>

        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .min-h-screen {
            min-height: auto !important;
            background: none !important;
          }
          .shadow-xl, .border-slate-300 {
            box-shadow: none !important;
            border: none !important;
          }
          .mx-auto {
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function TaxInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      }
    >
      <TaxInvoiceContent />
    </Suspense>
  );
}
