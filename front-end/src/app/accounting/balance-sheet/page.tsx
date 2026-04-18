"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchAccounts, fetchCompany, contentUrl, type CompanyRow, fetchAccountingSettings } from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle, 
  Printer, 
  FileDown, 
  RefreshCw,
  Info,
  CalendarDays
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState("");
  const [fyStart, setFyStart] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [movementAccounts, setMovementAccounts] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    if (!asOfDate || !fyStart) return;
    setLoading(true);
    try {
      const [accs, moveAccs, comp] = await Promise.all([
        fetchAccounts({ asOf: asOfDate }),
        fetchAccounts({ from: fyStart, to: asOfDate }),
        fetchCompany().catch(() => null)
      ]);
      setAccounts(accs || []);
      setMovementAccounts(moveAccs || []);
      setCompany(comp);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const settings = await fetchAccountingSettings();
        setFyStart(settings.fy_start || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
        setAsOfDate(settings.fy_end || new Date().toISOString().split('T')[0]);
      } catch {
        setFyStart(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
        setAsOfDate(new Date().toISOString().split('T')[0]);
      }
    })();
  }, []);

  useEffect(() => {
    if (asOfDate && fyStart) load();
  }, [asOfDate, fyStart]);

  // Filter accounts by type (Uses cumulative for position, period for profit)
  const assets = accounts.filter(a => a.type === 'ASSET');
  const liabilities = accounts.filter(a => a.type === 'LIABILITY');
  const equityAccounts = accounts.filter(a => a.type === 'EQUITY');
  
  const incomeMovement = movementAccounts.filter(a => a.type === 'INCOME');
  const expenseMovement = movementAccounts.filter(a => a.type === 'EXPENSE');

  // Balances
  const totalAssets = assets.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(Number(a.balance) || 0), 0);
  const totalEquityFixed = equityAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  
  const totalIncomeYTD = incomeMovement.reduce((sum, a) => sum + (Number(a.period_balance) || 0), 0);
  const totalExpenseYTD = expenseMovement.reduce((sum, a) => sum + (Number(a.period_balance) || 0), 0);
  const currentYearProfit = Math.abs(totalIncomeYTD) - Math.abs(totalExpenseYTD);

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquityFixed + currentYearProfit;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

  const renderSection = (title: string, items: any[], showTotal: boolean, totalVal?: number) => (
    <div className="space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b pb-2">{title}</h3>
      <Table>
        <TableBody>
          {items.map(acc => (
             <TableRow key={acc.id} className="hover:bg-muted/30">
               <TableCell className="w-[120px] font-mono text-xs opacity-60">{acc.code}</TableCell>
               <TableCell className="font-medium">{acc.name}</TableCell>
               <TableCell className="text-right font-mono font-bold">
                 LKR {Math.abs(Number(acc.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
               </TableCell>
             </TableRow>
          ))}
          {showTotal && (
            <TableRow className="bg-muted/20 font-black border-t-2 border-primary/20">
              <TableCell colSpan={2} className="text-right uppercase text-[10px] tracking-widest">Total {title}</TableCell>
              <TableCell className="text-right font-mono text-lg">
                LKR {(totalVal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <DashboardLayout title="Statement of Financial Position">
      <div className="p-6 space-y-8 w-full mx-auto print:p-0 print:space-y-0 print:max-w-none">
        
        {/* Professional Print Header */}
        <div className="hidden print:flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8 mt-4">
           <div className="space-y-2">
             <h1 className="text-3xl font-black uppercase tracking-tighter">Statement of Financial Position</h1>
             <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">As of {asOfDate} • Generated {new Date().toLocaleTimeString()}</p>
           </div>
           <div className="text-right space-y-1">
             <p className="text-lg font-black uppercase">{company?.name}</p>
             <p className="text-xs text-slate-600">{company?.address}</p>
           </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 print:hidden">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter uppercase">Balance Sheet</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Position as of <span className="font-bold text-foreground underline">{asOfDate}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-2xl border border-muted-foreground/10 px-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase opacity-40">As of Date</span>
              <input 
                type="date" 
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-transparent border-none font-bold text-sm focus:ring-0 cursor-pointer"
              />
            </div>
            <div className="w-[1px] h-4 bg-muted-foreground/20 hidden sm:block" />
            <div className="flex items-center gap-2 ml-2">
              <Button variant="outline" onClick={() => window.open(`/accounting/balance-sheet/print?asOf=${asOfDate}`, '_blank')} className="gap-2 font-bold">
                <Printer className="w-4 h-4" /> Print Statement
              </Button>
              <Button variant="outline" size="icon" onClick={load} disabled={loading} className="h-9 w-9">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Validation Alert */}
        <div className={`p-6 rounded-3xl border-2 flex items-center gap-4 transition-all ${
          isBalanced ? 'bg-green-500/5 border-green-500/20 text-green-700' : 'bg-rose-500/5 border-rose-500/20 text-rose-700'
        }`}>
          {isBalanced ? <ShieldCheck className="w-8 h-8" /> : <AlertCircle className="w-8 h-8 animate-pulse" />}
          <div className="flex-1">
            <div className="font-black text-lg uppercase tracking-tight">
               {isBalanced ? "Equation Balanced" : "Out of Balance Warning"}
            </div>
            <p className="text-sm opacity-80 font-medium">
               {isBalanced 
                 ? "The fundamental accounting equation [A = L + E] is satisfied and validated." 
                 : `Discrepancy detected. Total Assets do not equal Total Liabilities and Equity.`}
            </p>
          </div>
          <div className="hidden md:block text-right">
             <div className="text-[10px] uppercase font-bold opacity-60">Accounting Equation Check</div>
             <div className="text-2xl font-black tabular-nums">{totalAssets.toLocaleString()} = {totalLiabilitiesAndEquity.toLocaleString()}</div>
          </div>
        </div>

        {/* Report Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Left Column: Assets */}
          <div className="space-y-12">
             <Card className="border shadow-sm overflow-hidden rounded-xl">
               <CardHeader className="bg-primary text-primary-foreground border-b-0 space-y-0 p-8">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70">Asset Statement</div>
                  <CardTitle className="text-4xl font-black tracking-tighter">TOTAL ASSETS</CardTitle>
                  <div className="text-2xl font-mono tabular-nums pt-2">LKR {totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
               </CardHeader>
               <CardContent className="p-8">
                  {renderSection("Assets", assets, false)}
               </CardContent>
             </Card>
          </div>

          {/* Right Column: Liabilities & Equity */}
          <div className="space-y-8">
             <Card className="border shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-2xl font-black border-l-4 border-orange-500 pl-4">Liabilities</CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                  {renderSection("Liabilities", liabilities, true, totalLiabilities)}
                </CardContent>
             </Card>

             <Card className="border shadow-sm rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50/50 to-transparent">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-2xl font-black border-l-4 border-indigo-500 pl-4">Equity</CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  {renderSection("Equity & Capital", equityAccounts, false)}
                  
                  {/* YTD Profit Line */}
                  <div className="pt-4 border-t space-y-4">
                    <div className="flex justify-between items-center text-sm p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                      <div>
                        <div className="font-bold text-indigo-700 uppercase text-[10px] tracking-wider">Current Period Earnings</div>
                        <div className="font-medium text-muted-foreground italic text-xs">From {fyStart} to {asOfDate}</div>
                      </div>
                      <div className="text-right">
                         <div className={`font-mono font-black text-lg ${currentYearProfit >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                           LKR {currentYearProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t-4 border-double flex justify-between items-end">
                    <div className="font-black text-sm uppercase tracking-widest text-muted-foreground">Total Liabilities & Equity</div>
                    <div className="text-right">
                      <div className="text-3xl font-black tabular-nums">
                        LKR {totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </CardContent>
             </Card>
          </div>

        </div>

        {/* Footer Info */}
        <div className="p-8 rounded-xl bg-muted/30 border border-dashed flex flex-col md:flex-row items-center justify-between gap-6 opacity-80 print:hidden">
           <div className="flex items-center gap-4">
             <div className="bg-primary/10 p-4 rounded-2xl">
               <ShieldCheck className="w-6 h-6 text-primary" />
             </div>
             <div>
               <div className="font-bold">Standard Financial Reporting</div>
               <p className="text-xs text-muted-foreground">This report follows the standard "Statement of Financial Position" model. Cumulative balances are calculated life-to-date.</p>
             </div>
           </div>
           <Badge variant="outline" className="px-6 py-2 rounded-full border-primary/20 bg-background font-bold text-primary italic">
             AUTOMATED POSITION - VERSION 2.0
           </Badge>
        </div>

      </div>
    </DashboardLayout>
  );
}

// Simple Badge component for the footer placeholder
function Badge({ children, className, variant = "default" }: any) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
