"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchAccounts, fetchCompany, contentUrl, fetchAccountingSettings, type CompanyRow } from "@/lib/api";
import { Loader2, Printer, X, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BalanceSheetPrintPage() {
  const [asOfDate, setAsOfDate] = useState("");
  const [fyStart, setFyStart] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [movementAccounts, setMovementAccounts] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      const params = new URLSearchParams(window.location.search);
      const asOf = params.get('asOf') || new Date().toISOString().split('T')[0];
      setAsOfDate(asOf);

      try {
        const settings = await fetchAccountingSettings();
        const start = settings.fy_start || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        setFyStart(start);

        const [accs, moveAccs, comp] = await Promise.all([
          fetchAccounts({ asOf }),
          fetchAccounts({ from: start, to: asOf }),
          fetchCompany().catch(() => null)
        ]);
        setAccounts(accs || []);
        setMovementAccounts(moveAccs || []);
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
    if (!loading && accounts.length > 0 && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, accounts]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium tracking-tight">Preparing Statement of Position...</p>
        </div>
      </div>
    );
  }

  const assets = accounts.filter(a => a.type === 'ASSET');
  const liabilities = accounts.filter(a => a.type === 'LIABILITY');
  const equityAccounts = accounts.filter(a => a.type === 'EQUITY');
  
  const incomeMovement = movementAccounts.filter(a => a.type === 'INCOME');
  const expenseMovement = movementAccounts.filter(a => a.type === 'EXPENSE');

  const totalAssets = assets.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(Number(a.balance) || 0), 0);
  const totalEquityFixed = equityAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  
  const totalIncomeYTD = incomeMovement.reduce((sum, a) => sum + (Number(a.period_balance) || 0), 0);
  const totalExpenseYTD = expenseMovement.reduce((sum, a) => sum + (Number(a.period_balance) || 0), 0);
  const currentYearProfit = Math.abs(totalIncomeYTD) - Math.abs(totalExpenseYTD);

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquityFixed + currentYearProfit;

  const renderSection = (title: string, items: any[], showTotal: boolean, totalVal?: number) => (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1 mb-2">{title}</h3>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-slate-100 italic">
          {items.map(acc => (
             <tr key={acc.id}>
               <td className="py-2 px-1 w-[80px] font-mono text-[10px] opacity-40 uppercase">{acc.code}</td>
               <td className="py-2 px-1 font-bold text-slate-800">{acc.name}</td>
               <td className="py-2 px-1 text-right font-mono font-black text-slate-900 uppercase">
                 LKR {Math.abs(Number(acc.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
               </td>
             </tr>
          ))}
          {showTotal && (
            <tr className="bg-slate-50 font-black border-t-2 border-slate-900">
              <td colSpan={2} className="py-4 px-2 text-right uppercase text-[9px] tracking-widest">Total {title}</td>
              <td className="py-4 px-1 text-right font-mono text-[14px]">
                LKR {(totalVal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

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
            <span className="text-slate-400 text-xs font-mono ml-2 uppercase">Balance Sheet</span>
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
               <h1 className="text-3xl font-black uppercase tracking-tighter">Statement of Position</h1>
               <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Balance Sheet as of {asOfDate} • Generated {new Date().toLocaleTimeString()}</p>
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

          <div className="grid grid-cols-2 gap-12 items-start">
             {/* Assets */}
             <div className="space-y-8">
                <div className="p-5 bg-slate-900 text-white rounded-xl mb-4">
                   <div className="text-[9px] font-black uppercase tracking-widest opacity-50">Grand Total</div>
                   <div className="text-xl font-black tracking-tight uppercase">Assets</div>
                   <div className="text-2xl font-mono tabular-nums pt-1">LKR {totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                {renderSection("Assets", assets, false)}
             </div>

             {/* Liabilities & Equity */}
             <div className="space-y-8 border-l border-slate-100 pl-8">
                {renderSection("Liabilities", liabilities, true, totalLiabilities)}
                
                <div className="space-y-4 pt-4 mt-8 border-t-2 border-slate-100">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1 mb-2">Equity & Performance</h3>
                   <table className="w-full text-xs">
                     <tbody className="divide-y divide-slate-100 italic">
                        {equityAccounts.map(acc => (
                           <tr key={acc.id}>
                             <td className="py-2 px-1 w-[80px] font-mono text-[10px] opacity-40 uppercase">{acc.code}</td>
                             <td className="py-2 px-1 font-bold text-slate-800">{acc.name}</td>
                             <td className="py-2 px-1 text-right font-mono font-black text-slate-900 uppercase">
                               LKR {Math.abs(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                             </td>
                           </tr>
                        ))}
                        <tr className="bg-indigo-50/50">
                          <td className="py-3 px-2 font-black text-indigo-900 uppercase text-[9px] tracking-wider" colSpan={2}>
                             NP/NL Performance (YTD)
                          </td>
                          <td className="py-3 px-1 text-right font-mono font-black text-indigo-900 border-l border-indigo-100/30 uppercase">
                             LKR {currentYearProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr className="bg-slate-900 text-white font-black">
                          <td className="py-5 px-3 text-right text-[10px] uppercase tracking-[0.2em]" colSpan={2}>Total L + E</td>
                          <td className="py-5 px-2 text-right font-mono text-[16px]">
                            LKR {totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                     </tbody>
                   </table>
                </div>
             </div>
          </div>

          {/* Footer */}
          <div className="mt-16 flex flex-col items-center justify-center text-center space-y-2 opacity-60 border-t border-slate-100 pt-8">
             <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-900" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">{company?.name} • Automated Statement of Position</span>
             </div>
             <p className="text-[8px] text-slate-400 font-medium px-24 leading-tight uppercase tracking-widest leading-loose">
                This Balance Sheet reflects the financial standing as of {asOfDate}. All figures are derived from the real-time General Ledger. 
                Certified computer generated report.
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
