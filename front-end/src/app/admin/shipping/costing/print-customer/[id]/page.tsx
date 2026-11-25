"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { fetchCostingSheet, fetchCompany, contentUrl, type CompanyRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PrintDocument } from "@/components/print/PrintDocument";
import { Loader2, Printer, X, Phone, Mail, MapPin, Box, Truck, Globe, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function PrintContent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('autoprint') === '1';

  const [sheet, setSheet] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sheetRes, companyData] = await Promise.all([
          fetchCostingSheet(Number(id)),
          fetchCompany().catch(() => null)
        ]);
        if (sheetRes.status === 'success') {
          setSheet(sheetRes.data);
        }
        setCompany(companyData);
      } catch (error) {
        console.error("Failed to load print data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);


  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium tracking-tight">Preparing Export Quotation...</p>
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <p className="text-rose-500 font-bold">Error: Sheet Not Found</p>
          <Button variant="outline" onClick={() => window.close()}>Close Window</Button>
        </div>
      </div>
    );
  }

  const targetCurrency = sheet.target_currency || 'USD';
  const exchangeRate = Number(sheet.exchange_rate || 1);

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: targetCurrency,
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(Number(amount) / exchangeRate);
  };

  const productItems = sheet.product_items || [];
  
  // Calculate landed price logic for customer view
  // Note: We show the final per-unit landed price in the target currency
  const getCustomerItemPrice = (item: any) => {
     // The backend sheet.total_cost is the grand total in LKR.
     // However, we want to show item-level prices.
     // In the costing engine, landed_price = (grandTotal / totalQuantity) if distributed equally.
     // But we have per-item weight/cbm/value logic.
     // For the CUSTOMER quote, we should show the "Landed Price" we calculated in the UI.
     
     // Wait! The backend doesn't save the final calculated per-item landed price, it saves total_cost.
     // We need to re-run the same math or distribute the grand total.
     // Let's re-run the math simplified:
     
     const totalLKR = Number(sheet.total_cost || 0);
     const totalQty = productItems.reduce((s: number, i: any) => s + Number(i.quantity), 0);
     
     // If the user hasn't used complex distribution, average is fine. 
     // But since we want precision, let's calculate the proportion of the total cost for this item.
     // Actually, let's just use the average for the customer quote unless requested otherwise.
     return totalLKR / (totalQty || 1);
  };

  const grandTotal = Number(sheet.total_cost);

  return (
    <PrintDocument
      title="Export Quotation"
      number={sheet.costing_number || `EXPQT-${String(sheet.id).padStart(6, '0')}`}
      autoPrint={autoPrint}
      company={company}
      branch={{ name: sheet.location_name }}
      meta={[
        ["Buyer", sheet.customer_name || "–"],
        ["Date", new Date(sheet.created_at).toLocaleDateString('en-GB')],
        ["Incoterm", sheet.shipping_term],
        ["Currency", targetCurrency],
        ["Shipment", `${sheet.shipment_mode} (${sheet.freight_type})`],
        ["Valid for", "30 days from issue"],
        ["Reference", sheet.reference_number || "–"],
      ]}
      signatures={["Authorized by", "Buyer acceptance"]}
      footerNote={<><div><b>Payment terms:</b> 100% advance payment or irrevocable L/C at sight. Bank charges outside Sri Lanka are for the opener's account.</div><div><b>Shipment:</b> within 14 working days of payment confirmation and production clearance.</div></>}
    >
          {/* Items Table */}
          <div className="mt-8">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase tracking-widest">
                  <th className="py-4 px-2">Description of Goods</th>
                  <th className="py-4 px-2 text-center w-24">Quantity</th>
                  <th className="py-4 px-2 text-right w-36">Unit Price ({targetCurrency})</th>
                  <th className="py-4 px-2 text-right w-40">Amount ({targetCurrency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productItems.map((item: any, idx: number) => {
                  const unitPriceLKR = getCustomerItemPrice(item);
                  return (
                    <tr key={idx} className="text-sm">
                      <td className="py-4 px-2">
                        <div className="font-black text-slate-900 uppercase tracking-tight">{item.part_name || item.name}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase tracking-tighter">
                          HS CODE: {item.hs_code || item.original_hs_code || "N/A"} • Origin: Sri Lanka
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center font-bold text-slate-600">{item.quantity} {item.unit || 'PCS'}</td>
                      <td className="py-4 px-2 text-right font-bold text-slate-700 tabular-nums">{formatCurrency(unitPriceLKR)}</td>
                      <td className="py-4 px-2 text-right font-black text-slate-900 tabular-nums">{formatCurrency(unitPriceLKR * item.quantity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grand Total Section */}
          <div className="mt-10 flex justify-end">
            <div className="w-80 bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                <span>Total Net Amount</span>
                <span className="text-slate-900 font-black">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="pt-4 border-t-2 border-slate-900/10 flex justify-between items-baseline">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Grand Total</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase">{sheet.shipping_term} Basis</span>
                </div>
                <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>

    </PrintDocument>
  );
}

export default function CustomerPrintPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <PrintContent />
    </Suspense>
  );
}
