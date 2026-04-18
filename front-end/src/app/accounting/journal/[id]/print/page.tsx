"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { 
  fetchJournalEntries, 
  fetchJournalItems, 
  fetchCompany, 
  contentUrl, 
  type CompanyRow 
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Printer, 
  X, 
  Phone, 
  Mail, 
  MapPin,
  FileText,
  Hash,
  Calendar,
  Layers
} from "lucide-react";

function JournalPrintContent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('autoprint') === '1';

  const [entry, setEntry] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [entries, entryItems, companyData] = await Promise.all([
          fetchJournalEntries({ id }),
          fetchJournalItems(id),
          fetchCompany().catch(() => null)
        ]);
        
        if (entries && entries.length > 0) {
          setEntry(entries[0]);
        }
        setItems(entryItems || []);
        setCompany(companyData);
      } catch (error) {
        console.error("Failed to load journal print data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (autoPrint && !loading && entry && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loading, entry]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium tracking-tight tracking-widest uppercase text-[10px]">Preparing Voucher...</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <p className="text-rose-500 font-bold tracking-tight">Voucher Not Found</p>
          <Button variant="outline" onClick={() => window.close()}>Close Window</Button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'LKR',
      minimumFractionDigits: 2 
    }).format(Number(amount));
  };

  return (
    <div className="min-h-screen bg-slate-100/50 print:bg-white text-slate-900">
      {/* 1. Control Bar */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">Journal Voucher Preview</span>
            <span className="text-slate-400 text-xs font-mono ml-2">JV-{entry.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.close()} className="text-slate-500 hover:text-slate-900 font-bold uppercase text-[10px] tracking-widest">
              <X className="w-4 h-4 mr-2" /> Close
            </Button>
            <Button size="sm" onClick={() => window.print()} className="bg-primary shadow-lg shadow-primary/20 font-bold uppercase text-[10px] tracking-widest">
              <Printer className="w-4 h-4 mr-2" /> Print Voucher
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Paper Area */}
      <div className="py-6 print:py-0">
        <div className="mx-auto w-[210mm] min-h-[148mm] bg-white shadow-2xl print:shadow-none print:w-full print:border-none px-12 py-6 border border-slate-200">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
            <div className="space-y-2">
              {company?.logo_filename ? (
                <img src={contentUrl('company', company.logo_filename)} alt="Logo" className="h-12 w-auto object-contain" />
              ) : (
                <div className="w-12 h-12 bg-slate-900 flex items-center justify-center rounded-lg text-white">
                  JV
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-none">Journal Voucher</h1>
                <p className="text-slate-400 font-mono text-[10px] tracking-[0.3em] mt-1 uppercase">VOUCHER</p>
              </div>
            </div>
            
            <div className="text-right space-y-0.5 pt-1 uppercase">
              <p className="text-base font-black text-slate-900">
                {company?.name || "ServiceBay Solutions"}
              </p>
              <div className="text-[10px] text-slate-500 space-y-0 max-w-[200px] ml-auto leading-tight font-medium">
                <p>{company?.address}</p>
                <div className="flex items-center justify-end gap-2">
                  <span>{company?.phone}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Voucher ID</label>
                <p className="text-lg font-black text-slate-900 font-mono">#JV-{entry.id}</p>
              </div>
              <div className="text-right space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Reference</label>
                <p className="text-[10px] font-bold text-slate-700 uppercase leading-none">
                  {entry.ref_type ? `${entry.ref_type} #${entry.ref_id}` : "Manual"}
                </p>
              </div>
            </div>
            
            <div className="py-1 space-y-2">
              <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Entry Date</span>
                <span className="text-xs font-bold text-slate-900">{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Description</label>
                <p className="text-[10px] text-slate-600 font-medium leading-tight italic truncate max-w-xs">
                  {entry.description || "No description provided."}
                </p>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-6">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest">
                  <th className="px-5 py-3">Account Details</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3 text-right w-32">Debit (LKR)</th>
                  <th className="px-5 py-3 text-right w-32">Credit (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 italic">
                {items.map((item, idx) => (
                  <tr key={idx} className="group">
                    <td className="px-5 py-2">
                       <div className="space-y-0.5">
                          <p className="text-[11px] font-black text-slate-900 uppercase leading-none">{item.account_name}</p>
                          <p className="text-[9px] font-mono font-bold text-slate-400 leading-none">{item.account_code}</p>
                        </div>
                    </td>
                    <td className="px-5 py-2 text-[9px] text-slate-500 font-medium truncate max-w-[150px]">
                      {item.notes || "-"}
                    </td>
                    <td className="px-5 py-2 text-right font-mono font-bold text-xs">
                      {Number(item.debit) > 0 ? (
                        <span>{Number(item.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      ) : "-"}
                    </td>
                    <td className="px-5 py-2 text-right font-mono font-bold text-xs">
                      {Number(item.credit) > 0 ? (
                        <span>{Number(item.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-300">
                  <td colSpan={2} className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">
                    Voucher Total
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-black text-sm text-slate-900">
                    {formatCurrency(entry.total_amount).replace('LKR', '')}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-black text-sm text-slate-900">
                    {formatCurrency(entry.total_amount).replace('LKR', '')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Authentication & Footer */}
          <div className="grid grid-cols-3 gap-10 text-center text-[9px] font-black uppercase tracking-widest text-slate-400 mt-6">
            <div className="space-y-3">
              <div className="h-px bg-slate-200" />
              <p>Prepared By</p>
            </div>
            <div className="space-y-3">
              <div className="h-px bg-slate-200" />
              <p>Checked By</p>
            </div>
            <div className="space-y-3">
              <div className="h-px bg-slate-200" />
              <p>Authorized By</p>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @media print {
          @page {
            size: A5 landscape;
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
          .mx-auto {
            margin: 0 !important;
            width: 210mm !important;
            height: 148mm !important;
            min-height: 148mm !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function JournalPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <JournalPrintContent />
    </Suspense>
  );
}
