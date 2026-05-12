"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { fetchCostingSheet, fetchCompany, contentUrl, type CompanyRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, X, Phone, Mail, MapPin, Calculator, Calendar, Globe, Box, Truck, ShieldCheck, TrendingUp } from "lucide-react";
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
          <p className="text-slate-500 font-medium tracking-tight">Preparing Management Costing Report...</p>
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <p className="text-rose-500 font-bold">Error: Costing Sheet Not Found</p>
          <Button variant="outline" onClick={() => window.close()}>Close Window</Button>
        </div>
      </div>
    );
  }

  const formatLKR = (amount: number | string) => {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 3 }).format(Number(amount));
  };

  const formatTarget = (amount: number | string) => {
    const rate = Number(sheet.exchange_rate || 1);
    const converted = Number(amount) / rate;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: sheet.target_currency || 'USD', minimumFractionDigits: 3 }).format(converted);
  };

  // Internal Logic for Display (Mirrors Frontend logic but in print format)
  const productItems = sheet.product_items || [];
  const totalBaseCost = productItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unit_cost)), 0);
  const totalQuantity = productItems.reduce((sum: number, item: any) => sum + Number(item.quantity), 0);
  const totalWeight = productItems.reduce((sum: number, item: any) => sum + (Number(item.weight || 0) * Number(item.quantity)), 0);
  const totalCbm = productItems.reduce((sum: number, item: any) => sum + (Number(item.volume_cbm || 0) * (Number(item.quantity) / Number(item.units_per_carton || 1))), 0);

  const manualCosts = (sheet.items || []).filter((i: any) => i.cost_type === 'Manual');
  const templateCosts = (sheet.items || []).filter((i: any) => i.cost_type !== 'Manual');
  const totalDirectLogistics = manualCosts.reduce((sum: number, i: any) => sum + Number(i.calculated_amount), 0);
  const totalTemplateCharges = templateCosts.reduce((sum: number, i: any) => sum + Number(i.calculated_amount), 0);
  
  const grandTotal = Number(sheet.total_cost);
  const totalProfit = grandTotal - (totalBaseCost + totalDirectLogistics + totalTemplateCharges + Number(sheet.other_costs || 0));

  return (
    <div className="min-h-screen bg-slate-100/50 print:bg-white">
      {/* 1. Control Bar */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">Management Costing Report</span>
            <span className="text-slate-400 text-xs font-mono ml-2">ID: {sheet.costing_number || sheet.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.close()} className="text-slate-500 hover:text-slate-900">
              <X className="w-4 h-4 mr-2" /> Close
            </Button>
            <Button size="sm" onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
              <Printer className="w-4 h-4 mr-2" /> Print Report
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Paper Area */}
      <div className="py-8 print:py-0">
        <div className="mx-auto w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none print:w-full print:border-none px-12 py-10 text-slate-900 border border-slate-200">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
            <div className="space-y-3">
              {company?.logo_filename && (
                <img src={contentUrl('company', company.logo_filename)} alt="Logo" className="w-16 h-16 object-contain" />
              )}
              <div>
                <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-none">Management Costing Analysis</h1>
                <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-[0.3em] mt-1">Export Logistics & Landing Sheet</p>
              </div>
            </div>
            
            <div className="text-right space-y-1">
              <h2 className="text-lg font-black text-slate-900 uppercase leading-none">{company?.name || "ServiceBay Solutions"}</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{sheet.location_name || "Head Office - Export Division"}</p>
              <div className="text-[10px] text-slate-400 font-medium">
                Costing No: <span className="text-slate-900 font-black">{sheet.costing_number || `EXPQT-${String(sheet.id).padStart(6, '0')}`}</span><br/>
                Ref: <span className="text-slate-900 font-black">{sheet.reference_number || 'N/A'}</span><br/>
                Date: <span className="text-slate-900 font-black">{new Date(sheet.created_at).toLocaleDateString('en-GB')}</span>
              </div>
            </div>
          </div>

          {/* Shipment Meta Card */}
          <div className="grid grid-cols-3 gap-6 py-6 border-b border-slate-100">
            <div className="space-y-1">
               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Buyer / Customer</span>
               <p className="text-sm font-black text-slate-900 leading-tight">{sheet.customer_name || "Generic Buyer"}</p>
               <Badge variant="outline" className="text-[8px] uppercase font-black border-slate-200 text-slate-500">{sheet.status}</Badge>
            </div>
            <div className="space-y-1">
               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Logistics Info</span>
               <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                 <Truck className="w-3 h-3 text-indigo-500" /> {sheet.freight_type} / {sheet.shipment_mode}
               </div>
               <p className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Incoterm: {sheet.shipping_term}</p>
            </div>
            <div className="space-y-1 text-right">
               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Pricing Base</span>
               <p className="text-[11px] font-bold text-slate-700">{sheet.profit_method} on {sheet.profit_base} Cost</p>
               {sheet.target_currency !== 'LKR' && (
                 <div className="flex items-center justify-end gap-1 text-[10px] font-black text-amber-600 uppercase italic">
                   <Globe className="w-3 h-3" /> 1 {sheet.target_currency} = {Number(sheet.exchange_rate).toLocaleString()} LKR
                 </div>
               )}
            </div>
          </div>

          {/* Product Cost Table */}
          <div className="mt-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mb-3 flex items-center gap-2">
               <Box className="w-3 h-3 text-indigo-600" /> Product Base Analysis
            </h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest">
                  <th className="p-2 text-left rounded-l">Item Description</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Unit Cost</th>
                  <th className="p-2 text-right rounded-r">Base Total (LKR)</th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {productItems.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-2 py-3">
                      <div className="font-black text-slate-900">{item.part_name || item.name}</div>
                      <div className="text-[8px] text-slate-400 uppercase tracking-tighter">HS: {item.hs_code || item.original_hs_code || "N/A"} • SKU: {item.sku || "N/A"} • {item.weight}kg • {item.packing_type}</div>
                    </td>
                    <td className="p-2 text-center font-bold text-slate-600">{item.quantity}</td>
                    <td className="p-2 text-right font-bold text-slate-700 tabular-nums">{Number(item.unit_cost).toLocaleString()}</td>
                    <td className="p-2 text-right font-black text-slate-900 tabular-nums">{(Number(item.quantity) * Number(item.unit_cost)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                 <tr className="bg-slate-50/80 font-black text-[10px]">
                   <td className="p-2 rounded-l">SUMMARY TOTALS</td>
                   <td className="p-2 text-center">{totalQuantity} Units</td>
                   <td className="p-2 text-right text-slate-400">SUBTOTAL</td>
                   <td className="p-2 text-right rounded-r">{totalBaseCost.toLocaleString()}</td>
                 </tr>
              </tfoot>
            </table>
          </div>

          {/* Financial Breakdown Grid */}
          <div className="mt-8 grid grid-cols-2 gap-10">
            {/* Left: Detailed Charges */}
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5 border-b border-indigo-100 pb-1">
                   Direct Logistics (Manual)
                </h4>
                <div className="space-y-1.5 px-1">
                   {manualCosts.length > 0 ? manualCosts.map((i: any, idx: number) => (
                     <div key={idx} className="flex justify-between items-center text-[10px]">
                       <span className="text-slate-500 font-medium capitalize">{i.name}</span>
                       <span className="font-bold tabular-nums text-slate-800">{Number(i.calculated_amount).toLocaleString()}</span>
                     </div>
                   )) : <p className="text-[9px] text-slate-400 italic">No manual charges added</p>}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5 border-b border-indigo-100 pb-1">
                   Levies & Absorption (Template)
                </h4>
                <div className="space-y-1.5 px-1">
                   {templateCosts.length > 0 ? templateCosts.map((i: any, idx: number) => (
                     <div key={idx} className="flex justify-between items-center text-[10px]">
                       <div className="flex flex-col">
                         <span className="text-slate-500 font-medium">{i.name}</span>
                         <span className="text-[7px] text-slate-300 uppercase leading-none">Dist: {i.absorption_method || 'Value'}</span>
                       </div>
                       <span className="font-bold tabular-nums text-slate-800">{Number(i.calculated_amount).toLocaleString()}</span>
                     </div>
                   )) : <p className="text-[9px] text-slate-400 italic">No template charges applied</p>}
                </div>
              </div>
            </div>

            {/* Right: Profit & Final Analysis */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2 border-b border-white/10 pb-2">Grand Summary (LKR)</h4>
              
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] opacity-70">
                   <span>Total Base Product Cost</span>
                   <span className="tabular-nums font-bold">{totalBaseCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] opacity-70">
                   <span>Logistics & Levies</span>
                   <span className="tabular-nums font-bold">+ {(totalDirectLogistics + totalTemplateCharges).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] opacity-70">
                   <span>Other Overheads</span>
                   <span className="tabular-nums font-bold">+ {Number(sheet.other_costs || 0).toLocaleString()}</span>
                </div>
                
                <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-center text-amber-400">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase leading-none">Management Profit</span>
                      <span className="text-[7px] opacity-60 uppercase">{sheet.profit_method} @ {sheet.profit_value}%</span>
                   </div>
                   <span className="text-lg font-black tabular-nums">{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                </div>

                <div className="pt-4 mt-4 border-t-2 border-white/20">
                   <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Final Landed Value</span>
                      <Badge className="bg-indigo-500 text-[8px] font-black uppercase px-1.5 h-4">FOB / CIF</Badge>
                   </div>
                   <p className="text-3xl font-black tabular-nums tracking-tighter">LKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 3 })}</p>
                   
                   {sheet.target_currency !== 'LKR' && (
                     <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-500">Converted Value ({sheet.target_currency})</span>
                        <span className="text-lg font-black text-indigo-200 tabular-nums">
                          {formatTarget(grandTotal)}
                        </span>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="mt-8 grid grid-cols-4 gap-4">
             <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest block mb-1">Avg Price / Unit</span>
                <span className="text-xs font-black text-slate-900">{formatLKR(grandTotal / (totalQuantity || 1))}</span>
             </div>
             <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest block mb-1">Logistics Factor</span>
                <span className="text-xs font-black text-indigo-600">{(((totalDirectLogistics + totalTemplateCharges) / (totalBaseCost || 1)) * 100).toFixed(2)}%</span>
             </div>
             <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest block mb-1">Total Weight (KG)</span>
                <span className="text-xs font-black text-slate-900">{totalWeight.toFixed(2)} KG</span>
             </div>
             <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest block mb-1">Total Volume (CBM)</span>
                <span className="text-xs font-black text-slate-900">{totalCbm.toFixed(4)} CBM</span>
             </div>
          </div>

          {/* Footer Info */}
          <div className="mt-12 pt-8 border-t border-slate-50 flex justify-between items-end italic text-slate-400">
             <div className="space-y-1">
                <p className="text-[8px] font-bold uppercase tracking-widest leading-none">Internal Management Use Only</p>
                <p className="text-[7px] max-w-xs leading-tight opacity-70 uppercase tracking-tighter">
                   This analysis contains confidential product cost and profit margin data. Do not share with external buyers or unauthorized personnel.
                </p>
             </div>
             <div className="flex flex-col items-end">
                <div className="w-32 h-px bg-slate-200 mb-1"></div>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-900">Finance Approval</p>
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
          .bg-slate-100\\/50, .py-8, .shadow-2xl, .border-slate-200 {
            background: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .mx-auto {
            margin: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
          }
          /* Fix for dark backgrounds on print */
          .bg-slate-900 {
            background-color: #0f172a !important;
            color: white !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function CostingPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
