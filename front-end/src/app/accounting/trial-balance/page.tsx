"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, Printer, ShieldCheck, AlertCircle, Calendar } from "lucide-react";
import { fetchAccounts, fetchCompany, type CompanyRow, fetchAccountingSettings, contentUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function TrialBalancePage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState("");
  const { toast } = useToast();

  const totalDebits = accounts.reduce((sum, acc) => {
    const bal = Number(acc.balance) || 0;
    return sum + (bal > 0 ? bal : 0);
  }, 0);
  
  const totalCredits = accounts.reduce((sum, acc) => {
    const bal = Number(acc.balance) || 0;
    return sum + (bal < 0 ? Math.abs(bal) : 0);
  }, 0);

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const loadTrialBalance = async () => {
    if (!asOfDate) return;
    setLoading(true);
    try {
      const [accs, comp] = await Promise.all([
        fetchAccounts({ asOf: asOfDate }),
        fetchCompany().catch(() => null)
      ]);
      setAccounts(accs || []);
      setCompany(comp);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load Trial Balance",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const settings = await fetchAccountingSettings();
        setAsOfDate(settings.fy_end || new Date().toISOString().split('T')[0]);
      } catch (err) {
        setAsOfDate(new Date().toISOString().split('T')[0]);
      }
    })();
  }, []);

  useEffect(() => {
    if (asOfDate) {
      loadTrialBalance();
    }
  }, [asOfDate]);

  return (
    <DashboardLayout title="Statement of Trial Balance">
      <div className="p-6 space-y-8 w-full mx-auto print:p-0 print:max-w-none">
        
        {/* Professional Print Header */}
        <div className="hidden print:flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8 mt-4">
           <div className="space-y-2">
             {company?.logo_filename && (
               <img src={contentUrl('company', company.logo_filename)} alt="Logo" className="w-16 h-16 object-contain" />
             )}
             <div>
               <h1 className="text-3xl font-black uppercase tracking-tighter">Trial Balance Statement</h1>
               <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">As of {asOfDate} • Generated {new Date().toLocaleTimeString()}</p>
             </div>
           </div>
           <div className="text-right space-y-1 text-sm font-bold uppercase">
              {company?.name}
           </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 print:hidden">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight uppercase print:text-2xl">Trial Balance</h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Reporting Position as of <span className="text-foreground font-bold underline decoration-primary/30">{asOfDate}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-2xl border border-muted-foreground/10 px-4 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase opacity-40">As of Date</span>
              <input 
                type="date" 
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-transparent border-none font-bold text-sm focus:ring-0 cursor-pointer"
              />
            </div>
            <div className="w-[1px] h-4 bg-muted-foreground/20" />
            <Button variant="outline" size="icon" onClick={loadTrialBalance} disabled={loading} className="h-9 w-9">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="default" onClick={() => window.open(`/accounting/trial-balance/print?asOf=${asOfDate}`, '_blank')} className="gap-2 font-bold px-6 shadow-lg shadow-primary/20">
              <Printer className="w-4 h-4" /> Print Statement
            </Button>
          </div>
        </div>

        {/* Status Alert */}
        <div className={`p-6 rounded-3xl border-2 flex items-center gap-4 transition-all ${
          isBalanced ? 'bg-green-500/5 border-green-500/20 text-green-700' : 'bg-rose-500/5 border-rose-500/20 text-rose-700'
        }`}>
          {isBalanced ? <ShieldCheck className="w-8 h-8" /> : <AlertCircle className="w-8 h-8 animate-pulse" />}
          <div>
            <div className="font-black text-lg uppercase tracking-tight">
               {isBalanced ? "Ledger is Balanced" : "Out of Balance Detected"}
            </div>
            <p className="text-sm opacity-80 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
               {isBalanced 
                 ? "All debits match credits systematically. Your general ledger is mathematically correct." 
                 : "The sum of debits does not equal the sum of credits. Please check for unposted journals."}
            </p>
          </div>
        </div>

        {/* Trial Balance Table */}
        <Card className="border shadow-sm overflow-hidden rounded-xl">
          <Table>
            <TableHeader className="bg-muted/30 border-b-2">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[150px] font-black uppercase tracking-widest text-[10px]">Code</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[10px]">Account Name</TableHead>
                <TableHead className="text-right font-black uppercase tracking-widest text-[10px] w-[200px]">Debit (LKR)</TableHead>
                <TableHead className="text-right font-black uppercase tracking-widest text-[10px] w-[200px]">Credit (LKR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <RefreshCw className="w-10 h-10 animate-spin mx-auto text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground mt-4 font-medium italic">Generating trial balance report...</p>
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <p className="text-muted-foreground font-medium italic">No ledger entries found up to this date.</p>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {accounts.map((acc) => {
                    const bal = (Number(acc.balance) || 0);
                    if (bal === 0) return null;
                    return (
                      <TableRow key={acc.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono font-bold text-primary">{acc.code}</TableCell>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-blue-800">
                          {bal > 0 ? bal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-rose-800">
                          {bal < 0 ? Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold border-t-2 border-primary/20">
                    <TableCell colSpan={2} className="text-right uppercase tracking-widest text-xs px-8 py-6">Statement Total</TableCell>
                    <TableCell className="text-right font-mono text-xl text-blue-600">
                      {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xl text-rose-600">
                      {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Card>

      </div>
    </DashboardLayout>
  );
}
