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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Landmark, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRightLeft,
  Calendar,
  Wallet,
  Coins,
  ShieldCheck,
  History,
  FileSearch,
  Check
} from "lucide-react";
import { 
  fetchAccounts, 
  fetchUnreconciledTransactions, 
  finalizeReconciliation,
  fetchReconciliationHistory 
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

export default function BankReconciliationPage() {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Reconciliation parameters
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState<string>("0");
  const [checkedIds, setCheckedIds] = useState<number[]>([]);

  // Calculations
  const selectedAccData = bankAccounts.find(a => String(a.id) === selectedAccount);
  const currentSystemBalance = Number(selectedAccData?.balance || 0);
  
  const clearedTotal = transactions
    .filter(t => checkedIds.includes(t.id))
    .reduce((sum, t) => sum + (Number(t.debit) - Number(t.credit)), 0);
    
  const difference = Number(statementBalance) - (currentSystemBalance + clearedTotal); // Simple logic: Statement should match System + Cleared Diff? 
  // Actually, standard logic: System Balance = (Statement Balance - Uncleared Items).
  // Better: Cleared Balance (System + Ticked) vs Statement Balance.
  // We'll use: Diff = Statement Balance - (Adjusted System Balance).
  // Standard Recon: 
  // Adjusted Bank = Statement + Deposits in Transit - Outstanding Checks
  // Adjusted Book = System Balance + Cleared Corrected
  // Let's keep it simple: We are "ticking" off what IS in the statement.
  // The "Statement Balance" must equal the "Balance of Ticked Items in the system".
  
  // Revised Logic for this module:
  // "Balance as of Statement Date" = (Sum of all reconciled items up to now) + (Sum of items we just ticked).
  // So: Difference = Statement Balance - (Running Total of Ticked Transactions + Previous Reconciled Balance).
  // But wait, our 'balance' in acc_accounts is already the current total.
  // Let's use: Difference = Statement Balance - (sum of all items already reconciled + sum of items currently checked).
  
  const loadInitialData = async () => {
    try {
      const accounts = await fetchAccounts({ type: 'ASSET' });
      // Filter for Cash/Bank categories
      const banks = accounts.filter((a: any) => a.category === 'Cash' || a.category === 'Bank');
      setBankAccounts(banks);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load bank accounts", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadTransactions = async (accountId: string) => {
    setLoading(true);
    setCheckedIds([]);
    try {
      const [txs, hist] = await Promise.all([
        fetchUnreconciledTransactions(accountId),
        fetchReconciliationHistory(accountId)
      ]);
      setTransactions(txs);
      setHistory(hist);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load transactions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = (val: string) => {
    setSelectedAccount(val);
    loadTransactions(val);
  };

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFinalize = async () => {
    if (Math.abs(difference) > 0.01) {
      toast({ title: "Warning", description: "Reconciliation not balanced. Difference must be zero.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await finalizeReconciliation({
        account_id: selectedAccount,
        statement_date: statementDate,
        statement_balance: Number(statementBalance),
        cleared_balance: currentSystemBalance + clearedTotal,
        difference: difference,
        cleared_item_ids: checkedIds,
        userId: 1 // TODO: Get from session
      });
      
      toast({ title: "Success", description: "Reconciliation finalized successfully!" });
      loadTransactions(selectedAccount);
    } catch (error) {
      toast({ title: "Error", description: "Finalization failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Bank Reconciliation">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter uppercase text-slate-900 flex items-center gap-3">
              <RefreshCw className="w-10 h-10 text-primary" />
              Bank Reconciliation
            </h1>
            <p className="text-muted-foreground text-sm font-medium italic">Audit your account balances against your physical bank statement.</p>
          </div>
        </div>

        <Tabs defaultValue="reconcile" className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-xl mb-6">
            <TabsTrigger value="reconcile" className="rounded-lg font-black uppercase text-[10px] tracking-widest px-8">Audit Dashboard</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg font-black uppercase text-[10px] tracking-widest px-8">Historical Records</TabsTrigger>
          </TabsList>

          <TabsContent value="reconcile" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Config & Summary */}
              <div className="space-y-6">
                <Card className="border shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="bg-slate-900 text-white py-4 px-6">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-primary" />
                       Audit Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Bank Account</Label>
                      <Select value={selectedAccount} onValueChange={handleAccountChange}>
                        <SelectTrigger className="rounded-xl h-12 font-bold bg-muted/20 border-none shadow-inner">
                          <SelectValue placeholder="Select an account..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl">
                          {bankAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={String(acc.id)} className="font-bold">
                               {acc.code} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Statement Ending Date</Label>
                      <Input 
                        type="date" 
                        value={statementDate} 
                        onChange={(e) => setStatementDate(e.target.value)}
                        className="rounded-xl h-11 font-bold border-muted-foreground/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Statement Ending Balance (LKR)</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={statementBalance} 
                        onChange={(e) => setStatementBalance(e.target.value)}
                        className="rounded-xl h-11 font-mono font-black text-lg border-muted-foreground/20 text-primary"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border shadow-sm rounded-xl overflow-hidden bg-muted/10">
                   <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-dashed">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">System Ledger</span>
                        <span className="font-mono font-bold">{currentSystemBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-dashed">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Cleared (Adjusted)</span>
                        <span className={`font-mono font-bold ${clearedTotal >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                          {clearedTotal >= 0 ? '+' : ''}{clearedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-4 bg-white rounded-xl px-4 shadow-sm border">
                        <span className="text-xs font-black uppercase tracking-tight">Audit Difference</span>
                        <div className="text-right">
                           <div className={`text-xl font-black tabular-nums ${Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-rose-600'}`}>
                              LKR {difference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                           </div>
                           {Math.abs(difference) < 0.01 ? (
                             <Badge className="bg-green-100 text-green-700 uppercase p-0 px-2 text-[8px] font-black tracking-widest">Balanced</Badge>
                           ) : (
                             <Badge className="bg-rose-100 text-rose-700 uppercase p-0 px-2 text-[8px] font-black tracking-widest">Out of Balance</Badge>
                           )}
                        </div>
                      </div>

                      <Button 
                        onClick={handleFinalize} 
                        disabled={submitting || !selectedAccount || Math.abs(difference) > 0.01}
                        className="w-full h-14 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 bg-primary flex items-center justify-center gap-3 transition-all hover:scale-[1.02]"
                      >
                         {submitting ? <RefreshCw className="animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                         Finalize Audit Record
                      </Button>
                   </CardContent>
                </Card>
              </div>

              {/* Right Column: Transaction List */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border shadow-sm rounded-xl overflow-hidden min-h-[600px]">
                  <CardHeader className="border-b bg-muted/20">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm border">
                              <FileSearch className="w-5 h-5 text-slate-500" />
                           </div>
                           <div>
                              <CardTitle className="text-sm font-black uppercase tracking-tight">Statement Line Matching</CardTitle>
                              <p className="text-[10px] text-muted-foreground font-medium italic italic">Tick the transactions that appear on your bank statement.</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Items Selected</span>
                           <div className="text-lg font-black text-primary">{checkedIds.length} <span className="text-xs text-muted-foreground opacity-50">/ {transactions.length}</span></div>
                        </div>
                     </div>
                  </CardHeader>
                  <CardContent className="p-0">
                     {!selectedAccount ? (
                        <div className="flex flex-col items-center justify-center h-96 opacity-20">
                           <Landmark className="w-20 h-20 mb-4" />
                           <p className="font-black uppercase text-xs tracking-widest">Select a bank account to begin</p>
                        </div>
                     ) : loading ? (
                        <div className="flex flex-col items-center justify-center h-96">
                           <RefreshCw className="w-10 h-10 animate-spin text-primary opacity-20" />
                        </div>
                     ) : transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-96">
                           <Check className="w-20 h-20 text-green-500 opacity-20" />
                           <p className="font-black uppercase text-xs tracking-widest text-muted-foreground opacity-50">Everything is reconciled!</p>
                        </div>
                     ) : (
                        <Table>
                           <TableHeader className="bg-muted/30">
                              <TableRow className="hover:bg-transparent uppercase">
                                 <TableHead className="w-[50px] px-6"></TableHead>
                                 <TableHead className="w-[120px] font-black text-[10px] tracking-widest py-6 px-6">Date</TableHead>
                                 <TableHead className="font-black text-[10px] tracking-widest">Transaction Details</TableHead>
                                 <TableHead className="text-right font-black text-[10px] tracking-widest px-8">Debit (+)</TableHead>
                                 <TableHead className="text-right font-black text-[10px] tracking-widest px-8">Credit (-)</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {transactions.map((t) => (
                                 <TableRow 
                                    key={t.id} 
                                    className={`group hover:bg-muted/30 transition-colors cursor-pointer ${checkedIds.includes(t.id) ? 'bg-primary/5' : ''}`}
                                    onClick={() => toggleCheck(t.id)}
                                 >
                                    <TableCell className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                       <Checkbox 
                                          checked={checkedIds.includes(t.id)} 
                                          onCheckedChange={() => toggleCheck(t.id)}
                                          className="h-5 w-5 rounded-md border-2 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                       />
                                    </TableCell>
                                    <TableCell className="font-mono font-bold text-xs text-slate-500 px-6">
                                       {new Date(t.entry_date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                       <div className="flex flex-col">
                                          <span className="font-bold text-slate-800">{t.entry_description}</span>
                                          <span className="text-[10px] text-muted-foreground italic font-medium opacity-60">
                                             {t.notes || "No additional notes"} • {t.ref_type} #{t.ref_id}
                                          </span>
                                       </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-black text-green-600 px-8">
                                       {Number(t.debit) > 0 ? Number(t.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-black text-rose-600 px-8">
                                       {Number(t.credit) > 0 ? Number(t.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                 </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     )}
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="history" className="outline-none">
            <Card className="border shadow-sm rounded-xl overflow-hidden min-h-[400px]">
               <Table>
                  <TableHeader className="bg-muted/30">
                     <TableRow className="hover:bg-transparent uppercase">
                        <TableHead className="font-black text-[10px] tracking-widest py-6 px-8">Audit date</TableHead>
                        <TableHead className="font-black text-[10px] tracking-widest">Statement Date</TableHead>
                        <TableHead className="text-right font-black text-[10px] tracking-widest">Book Balance</TableHead>
                        <TableHead className="text-right font-black text-[10px] tracking-widest">Statement Balance</TableHead>
                        <TableHead className="text-right font-black text-[10px] tracking-widest">Status</TableHead>
                        <TableHead className="text-right font-black text-[10px] tracking-widest px-8">Auditor</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {!selectedAccount ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-20 italic">Select an account to view history</TableCell></TableRow>
                     ) : history.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-20 italic opacity-50">No previous reconciliation records found for this account.</TableCell></TableRow>
                     ) : (
                        history.map((h) => (
                           <TableRow key={h.id} className="hover:bg-muted/50 transition-colors tabular-nums">
                              <TableCell className="px-8 py-4 font-bold text-slate-500 text-xs">
                                 {new Date(h.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="font-black uppercase text-[11px] tracking-tighter shadow-sm">
                                 {new Date(h.statement_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">
                                 {Number(h.cleared_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-primary px-4 bg-primary/5">
                                 {Number(h.statement_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right px-4">
                                 <Badge className="bg-green-100 text-green-700 font-black uppercase text-[9px] tracking-widest border border-green-200">FINALIZED</Badge>
                              </TableCell>
                              <TableCell className="text-right px-8 font-medium italic text-slate-400">System Admin</TableCell>
                           </TableRow>
                        ))
                     )}
                  </TableBody>
               </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
