"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { fetchAccountLedger, fetchCompany, contentUrl, type CompanyRow } from "@/lib/api";
import { Loader2, Printer, X, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountLedgerPrintPage() {
  const params = useParams();
  const id = params.id as string;
  const printedRef = useRef(false);

  const [account, setAccount] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const from = queryParams.get('from');
      const to = queryParams.get('to');

      try {
        const [ledgerResponse, comp] = await Promise.all([
          fetchAccountLedger(id, { from: from || undefined, to: to || undefined }),
          fetchCompany().catch(() => null)
        ]);
        setAccount(ledgerResponse.account);
        setItems(ledgerResponse.data || []);
        setCompany(comp);
      } catch (error) {
        console.error("Failed to load print data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (!loading && items.length > 0 && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, items]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium tracking-tight">Preparing Ledger...</p>
        </div>
      </div>
    );
  }

  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const from = queryParams?.get('from');
  const to = queryParams?.get('to');
  
  let runningBalance = 0;

  return (
    <div className="min-h-screen bg-slate-100/50 print:bg-white text-slate-900">
      {/* Control Bar */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">Print Preview</span>
            <span className="text-slate-400 text-xs font-mono ml-2 uppercase">Account Ledger</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.close()}>
              <X className="w-4 h-4 mr-2" /> Close
            </Button>
            <Button size="sm" onClick={() => window.print()} className="bg-primary shadow-lg shadow-primary/20">
              <Printer className="w-4 h-4 mr-2" /> Print Document
            </Button>
          </div>
        </div>
      </div>

      {/* Paper Area */}
      <div className="py-6 print:py-0">
        <div className="mx-auto w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none print:w-full print:border-none px-12 py-10 border border-slate-200">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8 mt-4">
           <div className="space-y-4">
             {company?.logo_filename && (
               <img src={contentUrl('company', company.logo_filename)} alt="Logo" className="w-16 h-16 object-contain" />
             )}
             <div>
                <div className="flex items-center gap-2 mb-1">
                   <h1 className="text-2xl font-black uppercase tracking-tighter">Account Ledger</h1>
                   <div className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded uppercase">{account?.code}</div>
                </div>
                <h2 className="text-xl font-bold text-slate-700 italic">{account?.name}</h2>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mt-2 border-t pt-2 border-dashed">
                  Period: {from} to {to}
                </p>
             </div>
           </div>
           <div className="text-right space-y-1">
             <p className="text-lg font-black uppercase">{company?.name || "ServiceBay Solutions"}</p>
             <p className="text-[10px] text-slate-600 whitespace-pre-line leading-relaxed max-w-xs">{company?.address}</p>
             <div className="flex flex-col items-end gap-0.5 mt-2">
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700"><Phone className="w-2 h-2"/> {company?.phone}</div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700"><Mail className="w-2 h-2"/> {company?.email}</div>
                {company?.tax_no && <div className="text-[9px] font-black uppercase text-slate-900 mt-1">{company.tax_label}: {company.tax_no}</div>}
             </div>
           </div>
          </div>

          <table className="w-full text-left text-[10px]">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[9px] font-black uppercase tracking-widest bg-slate-50">
                <th className="py-3 px-2 w-[80px]">Date</th>
                <th className="py-3 px-2 w-[120px]">Reference</th>
                <th className="py-3 px-2">Description / Notes</th>
                <th className="py-3 px-2 text-right w-[100px]">Debit (LKR)</th>
                <th className="py-3 px-2 text-right w-[100px]">Credit (LKR)</th>
                <th className="py-3 px-2 text-right w-[120px]">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => {
                const debit = Number(item.debit || 0);
                const credit = Number(item.credit || 0);
                runningBalance += (debit - credit);

                return (
                  <tr key={item.entry_id}>
                    <td className="py-2.5 px-2 text-slate-600 font-medium">
                       {new Date(item.entry_date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-2 uppercase font-black tracking-tightest">
                       {item.ref_type} #{item.ref_id || 'JRN'}
                    </td>
                    <td className="py-2.5 px-2">
                       <p className="font-bold text-slate-800 italic">{item.entry_desc}</p>
                       {item.line_notes && <p className="text-[8px] text-slate-400 leading-tight mt-0.5">{item.line_notes}</p>}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold">
                       {debit > 0 ? debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold">
                       {credit > 0 ? credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                       {runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-black">
                <td colSpan={5} className="py-3 px-4 text-right uppercase text-[8px] tracking-[0.2em]">Selected Period Position</td>
                <td className="py-3 px-4 text-right font-mono text-sm whitespace-nowrap">
                  LKR {runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer Info */}
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center text-center opacity-40">
             <div className="flex items-center gap-2 mb-2">
               <MapPin className="w-3.5 h-3.5 text-slate-900" />
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">{company?.name} • Audit Trail Document</span>
             </div>
             <p className="text-[8px] text-slate-400 font-medium px-40 leading-tight uppercase tracking-widest">
                This account ledger is a chronological record of all financial activity. Confirmed by System Integrity Checks.
                Generated: {new Date().toLocaleString()}
             </p>
          </div>

        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background-color: white !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
