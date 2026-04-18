"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchFiscalPeriods, 
  createFiscalYear, 
  activateFiscalYear,
  fetchFiscalSummary,
  postFiscalClose 
} from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  CalendarDays, 
  Loader2, 
  Plus, 
  CheckCircle2, 
  Lock,
  History,
  Info,
  Play,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";

export default function FiscalManagementPage() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  
  // Closing Wizard State
  const [closingRecord, setClosingRecord] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [newYear, setNewYear] = useState({
    name: `FY ${new Date().getFullYear() + 1}`,
    start_date: `${new Date().getFullYear() + 1}-01-01`,
    end_date: `${new Date().getFullYear() + 1}-12-31`
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchFiscalPeriods();
      setPeriods(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!newYear.name || !newYear.start_date || !newYear.end_date) return;
    setCreating(true);
    try {
      await createFiscalYear(newYear);
      toast({ title: "Success", description: "New Fiscal Year created." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (id: number) => {
    setActivatingId(id);
    try {
      await activateFiscalYear(id);
      toast({ title: "Year Activated", description: "Reports will now default to this period." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActivatingId(null);
    }
  };

  const handleOpenClosing = async (record: any) => {
    setClosingRecord(record);
    setCalculating(true);
    try {
      const data = await fetchFiscalSummary(record.start_date, record.end_date, record.id);
      setSummary(data);
    } catch (err: any) {
      toast({ title: "Audit Error", description: err.message, variant: "destructive" });
      setClosingRecord(null);
    } finally {
      setCalculating(false);
    }
  };

  const handleFinalizeClosing = async () => {
    if (!closingRecord || !summary) return;
    
    setProcessing(true);
    try {
      await postFiscalClose({
        id: closingRecord.id,
        name: `Final Closing: ${closingRecord.name}`
      });
      toast({ title: "Year Locked", description: "Permanent closing entries have been posted." });
      setClosingRecord(null);
      setSummary(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Closing Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout title="Fiscal Management">
      <div className="p-6 space-y-8 max-w-[1400px] mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white">Fiscal Lifecycle</h1>
            <p className="text-muted-foreground font-medium">Define, activate, and close your financial years standardly.</p>
          </div>
          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center gap-3">
             <Info className="w-5 h-5 text-primary" />
             <div className="text-[10px] space-y-0.5">
                <p className="font-black uppercase tracking-widest opacity-60">System Rule</p>
                <p className="font-bold">Transaction dates are automatically validated against open periods.</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Section */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-primary/5 to-transparent rounded-[2rem]">
            <CardHeader className="p-8 pb-4">
              <div className="bg-primary/10 p-3 rounded-xl w-fit mb-4">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-black uppercase tracking-tight">New Fiscal Year</CardTitle>
              <CardDescription>Plan your upcoming operational periods.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60">Year Name</Label>
                 <Input 
                   value={newYear.name} 
                   onChange={e => setNewYear({...newYear, name: e.target.value})}
                   className="h-12 border-primary/20 bg-background/50 font-bold"
                 />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60">Start Date</Label>
                   <Input 
                     type="date"
                     value={newYear.start_date}
                     onChange={e => setNewYear({...newYear, start_date: e.target.value})}
                     className="h-12 border-primary/20 bg-background/50 font-bold"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60">End Date</Label>
                   <Input 
                     type="date"
                     value={newYear.end_date}
                     onChange={e => setNewYear({...newYear, end_date: e.target.value})}
                     className="h-12 border-primary/20 bg-background/50 font-bold"
                   />
                 </div>
               </div>
               <Button 
                onClick={handleCreate} 
                disabled={creating} 
                className="w-full h-12 rounded-xl font-black shadow-lg"
               >
                 {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Initiate Fiscal Year"}
               </Button>
            </CardContent>
          </Card>

          {/* List Section */}
          <div className="lg:col-span-2 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {loading ? (
                 <div className="col-span-2 p-12 text-center opacity-20">
                   <Loader2 className="w-12 h-12 animate-spin mx-auto" />
                 </div>
               ) : periods.length === 0 ? (
                 <div className="col-span-2 p-12 text-center border-2 border-dashed rounded-[2rem] opacity-40">
                    <p className="italic font-medium">No fiscal records defined yet.</p>
                 </div>
               ) : (
                 periods.map((p) => (
                   <Card key={p.id} className={`border-none shadow-lg rounded-[2rem] overflow-hidden transition-all hover:translate-y-[-4px] ${p.is_active ? 'ring-4 ring-primary ring-offset-2 bg-primary/5' : 'bg-muted/30'}`}>
                      <CardHeader className="p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl font-black uppercase">{p.name}</CardTitle>
                            <p className="text-xs font-bold opacity-60">{p.start_date} — {p.end_date}</p>
                          </div>
                          <Badge 
                            variant={p.is_closed ? "destructive" : p.is_active ? "default" : "outline"}
                            className="uppercase font-black text-[10px] px-3 py-1 rounded-full italic"
                          >
                            {p.is_closed ? "Locked" : p.is_active ? "Active" : "Open"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 pt-0 space-y-4">
                         {!p.is_closed && (
                           <div className="flex gap-2">
                             {!p.is_active && (
                               <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 rounded-xl font-black text-[10px] gap-2 hover:bg-primary hover:text-white transition-all"
                                onClick={() => handleActivate(p.id)}
                                disabled={activatingId === p.id}
                               >
                                 {activatingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                 Activate
                               </Button>
                             )}
                             <Button 
                               variant="default" 
                               size="sm" 
                               className="flex-1 rounded-xl font-black text-[10px] gap-2 bg-slate-900 shadow-md"
                               onClick={() => handleOpenClosing(p)}
                             >
                               <Lock className="w-3 h-3" />
                               Process Closing
                             </Button>
                           </div>
                         )}
                         {p.is_closed && (
                           <div className="p-4 rounded-2xl bg-muted border border-muted-foreground/10">
                              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                <History className="w-3 h-3" />
                                <span>Closed on {new Date(p.closed_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[10px] opacity-40 mt-1">Reference Entry: #{p.closing_entry_id}</p>
                           </div>
                         )}
                      </CardContent>
                   </Card>
                 ))
               )}
             </div>

             <div className="p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 flex items-start gap-4">
                <div className="bg-amber-500/20 p-3 rounded-2xl">
                   <CalendarCheck className="w-6 h-6 text-amber-600" />
                </div>
                <div className="space-y-1">
                   <h3 className="font-black uppercase text-sm text-amber-700">Accounting Protocol</h3>
                   <p className="text-xs text-amber-600 font-medium leading-relaxed">
                     An **Active** year serves as the default filter for your reports. Once a year is **Locked** (Closed), it is physically impossible to post any new transactions or modify existing ones within that date range. Ensure all reconciliations are complete before closing.
                   </p>
                </div>
             </div>
          </div>

        </div>

      </div>

      {/* Unified Closing Wizard Panel */}
      <Sheet open={!!closingRecord} onOpenChange={(open) => !open && setClosingRecord(null)}>
        <SheetContent className="w-[600px] sm:max-w-[700px] p-0 border-none bg-background shadow-2xl">
          <SheetHeader className="p-8 bg-slate-900 text-white">
             <div className="flex justify-between items-start">
               <div>
                  <Badge variant="outline" className="text-white/40 border-white/20 uppercase font-black text-[10px] italic mb-2">Year-End Finalization</Badge>
                  <SheetTitle className="text-3xl font-black uppercase text-white tracking-tight">{closingRecord?.name}</SheetTitle>
                  <SheetDescription className="text-white/60 font-medium">Permanent ledger audit and period locking.</SheetDescription>
               </div>
               <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/40 hover:text-white"
                onClick={() => setClosingRecord(null)}
               >
                 <X className="w-6 h-6" />
               </Button>
             </div>
          </SheetHeader>

          <div className="p-8 h-[calc(100vh-200px)] overflow-y-auto space-y-8">
             {calculating ? (
               <div className="p-20 text-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                  <p className="font-black uppercase text-xs tracking-widest opacity-40">Compiling Trial Balances...</p>
               </div>
             ) : summary ? (
               <>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 rounded-3xl bg-green-500/5 border border-green-500/10 dark:bg-green-500/10">
                       <h4 className="text-[10px] font-black uppercase text-green-600 mb-1">Total Revenue</h4>
                       <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">LKR {summary.total_income.toLocaleString()}</div>
                       <TrendingUp className="w-4 h-4 text-green-600 mt-2" />
                    </div>
                    <div className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10 dark:bg-rose-500/10">
                       <h4 className="text-[10px] font-black uppercase text-rose-600 mb-1">Total Expenses</h4>
                       <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">LKR {summary.total_expense.toLocaleString()}</div>
                       <TrendingDown className="w-4 h-4 text-rose-600 mt-2" />
                    </div>
                 </div>

                 <Card className="border-none shadow-md bg-muted/30 rounded-3xl overflow-hidden">
                    <CardHeader className="bg-muted px-6 py-4">
                       <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                         <Info className="w-3 h-3 text-primary" />
                         Account Level Audit
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                       <div className="divide-y divide-border/40">
                          {[...summary.income, ...summary.expenses].map((acc: any) => (
                            <div key={acc.id} className="p-4 px-6 flex justify-between items-center hover:bg-muted/50 transition-colors">
                               <div>
                                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{acc.name}</p>
                                  <p className="text-[10px] font-mono opacity-40">{acc.code} • {acc.type}</p>
                               </div>
                               <div className="font-mono font-bold text-sm">
                                 LKR {Math.abs(acc.period_balance).toLocaleString()}
                               </div>
                            </div>
                          ))}
                       </div>
                    </CardContent>
                 </Card>

                 <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full translate-x-10 translate-y-[-10px]"></div>
                    <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Net Profit Transfer</p>
                       <div className="text-5xl font-black tracking-tighter italic">LKR {summary.net_profit.toLocaleString()}</div>
                       <p className="text-xs text-white/60 max-w-[300px]">
                         This surplus will be permanently moved to **Retained Earnings** and all income/expense accounts will be zeroed out.
                       </p>
                    </div>
                 </div>

                 <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex gap-4">
                    <AlertCircle className="w-8 h-8 text-amber-600 flex-shrink-0" />
                    <div>
                       <h4 className="font-black uppercase text-[10px] text-amber-700 mb-1">Audit Protocol Warning</h4>
                       <p className="text-[11px] text-amber-600/80 font-medium leading-relaxed">
                          By finalizing this process, you are physically locking this financial year. This action is **NOT REVERSIBLE** without database level administrative access.
                       </p>
                    </div>
                 </div>
               </>
             ) : null}
          </div>

          <SheetFooter className="p-8 border-t bg-muted/20">
             <Button 
              className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-2xl gap-3 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={processing || calculating || !summary}
              onClick={handleFinalizeClosing}
             >
                {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Lock className="w-6 h-6" />}
                LOCK & SECURE FISCAL YEAR
             </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
