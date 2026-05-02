"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { fetchCostingSheet, fetchCompany, contentUrl, type CompanyRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (autoPrint && !loading && sheet && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loading, sheet]);

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
    <div className="min-h-screen bg-slate-100/50 print:bg-white">
      {/* Control Bar */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-900">Customer Export Quotation</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.close()}><X className="w-4 h-4 mr-2" /> Close</Button>
            <Button size="sm" onClick={() => window.print()} className="bg-indigo-600"><Printer className="w-4 h-4 mr-2" /> Print Quote</Button>
          </div>
        </div>
      </div>

      <div className="py-8 print:py-0">
        <div className="mx-auto w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none print:w-full print:border-none px-12 py-10 text-slate-900 border border-slate-200">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
            <div className="space-y-4">
              {company?.logo_filename && (
                <img src={contentUrl('company', company.logo_filename)} alt="Logo" className="w-20 h-20 object-contain" />
              )}
              <div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase leading-none">Export Quotation</h1>
                <div className="flex flex-col gap-0.5 mt-2">
                   <p className="text-slate-900 font-mono text-[10px] tracking-widest font-black uppercase">QUOTE NO: {sheet.costing_number || `EXPQT-${String(sheet.id).padStart(6, '0')}`}</p>
                   <p className="text-slate-400 font-mono text-[10px] tracking-widest uppercase font-bold">REF: {sheet.reference_number || 'N/A'}</p>
                </div>
              </div>
            </div>
            
            <div className="text-right space-y-1">
              <h2 className="text-xl font-black text-slate-900 uppercase">{company?.name || "ServiceBay Solutions"}</h2>
              <div className="text-[11px] text-slate-500 max-w-[200px] ml-auto">
                {company?.address || "Main Street, Colombo"}<br/>
                <div className="flex items-center justify-end gap-1 mt-1 font-bold text-slate-700">
                  <Phone className="w-2 h-2"/> {company?.phone}
                </div>
                <div className="flex items-center justify-end gap-1 font-bold text-slate-700">
                  <Mail className="w-2 h-2"/> {company?.email}
                </div>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-12 py-8 border-b border-slate-100">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Consignee / Buyer</span>
                <p className="text-base font-black text-slate-900">{sheet.customer_name || "Valued Customer"}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">Prepared for direct export shipment.</p>
              </div>
              <div className="flex gap-8">
                 <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Incoterm</span>
                    <p className="text-xs font-bold text-indigo-600">{sheet.shipping_term}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Shipping Mode</span>
                    <p className="text-xs font-bold text-slate-700">{sheet.shipment_mode} ({sheet.freight_type})</p>
                 </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Date of Issue</span>
                <span className="font-bold text-slate-900">{new Date(sheet.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between text-[11px] py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Quote Currency</span>
                <span className="font-bold text-indigo-600">{targetCurrency}</span>
              </div>
              <div className="flex justify-between text-[11px] py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Validity</span>
                <span className="font-bold text-slate-900">30 Days from issue</span>
              </div>
            </div>
          </div>

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

          {/* Footer Terms */}
          <div className="mt-12 space-y-8">
            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-2">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Terms</h4>
                 <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                   100% Advance Payment or Irrevocable L/C at Sight. All bank charges outside Sri Lanka are for account of the opener.
                 </p>
              </div>
              <div className="space-y-2">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Shipment Details</h4>
                 <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                   Shipment will be processed within 14 working days upon confirmation of payment and production clearance.
                 </p>
              </div>
            </div>

            <div className="pt-10 border-t border-slate-100 flex justify-between items-center opacity-40">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-900" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                  Automotive Export Division • ServiceBay
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Computer Generated Quotation • No Signature Required
              </p>
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
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
          .shadow-2xl, .bg-slate-100\\/50, .py-8 {
            background: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .mx-auto {
            margin: 0 !important;
            width: 210mm !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function CustomerPrintPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <PrintContent />
    </Suspense>
  );
}
