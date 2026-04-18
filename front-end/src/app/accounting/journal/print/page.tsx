"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchJournalEntries, fetchCompany, contentUrl, type CompanyRow } from "@/lib/api";
import { Loader2, Printer, X, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JournalPrintPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      const params = new URLSearchParams(window.location.search);
      const from = params.get('from') || "";
      const to = params.get('to') || "";
      setFromDate(from);
      setToDate(to);

      try {
        const [response, comp] = await Promise.all([
          fetchJournalEntries({ from, to, limit: 500 }), // Print larger set
          fetchCompany().catch(() => null)
        ]);
        if (response.status === 'success') {
          setEntries(response.data || []);
        }
        setCompany(comp);
      } catch (error) {
        console.error("Failed to load print data", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && entries.length > 0 && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, entries]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium tracking-tight">Preparing Journal Audit Log...</p>
        </div>
      </div>
    );
  }

  const grandTotal = entries.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100/50 print:bg-white text-slate-900">
      {/* Control Bar */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">Print Preview</span>
            <span className="text-slate-400 text-xs font-mono ml-2 uppercase">Journal Activity Log</span>
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
           <div className="space-y-2">
             {company?.logo_filename && (
               <img src={contentUrl('company', company.logo_filename)} alt="Logo" className="w-16 h-16 object-contain" />
             )}
             <div>
               <h1 className="text-3xl font-black uppercase tracking-tighter">Journal Activity Report</h1>
               <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Period: {fromDate} to {toDate} • Generated {new Date().toLocaleTimeString()}</p>
             </div>
           </div>
           <div className="text-right space-y-1">
             <p className="text-lg font-black uppercase">{company?.name}</p>
             <p className="text-[10px] text-slate-600 max-w-xs">{company?.address}</p>
             <div className="flex flex-col items-end gap-0.5 mt-2">
                <div className="text-[10px] font-bold text-slate-700">{company?.phone}</div>
                <div className="text-[10px] font-bold text-slate-700">{company?.email}</div>
             </div>
           </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[9px] font-black uppercase tracking-widest bg-slate-50">
                <th className="py-3 px-2 w-[80px]">ID</th>
                <th className="py-3 px-2 w-[100px]">Date</th>
                <th className="py-3 px-2">Description</th>
                <th className="py-3 px-2 w-[120px]">Reference</th>
                <th className="py-3 px-2 text-right w-[150px]">Amount (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic font-medium">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-2 font-mono font-bold text-slate-400"># {e.id}</td>
                  <td className="py-2.5 px-2 font-mono">{new Date(e.entry_date).toLocaleDateString()}</td>
                  <td className="py-2.5 px-2">{e.description}</td>
                  <td className="py-2.5 px-2 uppercase font-black text-[9px] tracking-tighter">
                    {e.ref_type ? `${e.ref_type} #${e.ref_id}` : '-'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-black text-slate-900">
                    {Number(e.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-900 text-white font-black">
                <td colSpan={4} className="text-right py-5 px-4 uppercase tracking-[0.2em] text-[10px]">Total Activity Valuation</td>
                <td className="py-5 px-2 text-right font-mono text-lg pr-4">
                  {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div className="mt-12 flex flex-col items-center justify-center text-center space-y-2 opacity-60 border-t border-slate-100 pt-8">
             <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-900" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">
                  {company?.name} • Accounting Audit Log
                </span>
             </div>
             <p className="text-[8px] text-slate-400 font-medium px-24 leading-tight uppercase tracking-widest leading-loose">
                This Journal Activity Report represents all postings made to the General Ledger within the specified period. 
                Certified for auditing and tax compliance. Computer generated - no signature required.
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
